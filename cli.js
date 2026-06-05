#!/usr/bin/env node

/**
 * sage - 极简博客 CLI 工具
 *
 * 在博客项目目录下运行:
 *   sage new [标题]          创建新文章模板
 *   sage build               构建静态站点
 *   sage preview [端口]      本地预览 (默认 8080)
 *   sage publish [消息]      Git 提交并推送
 *   sage status              查看站点状态
 *   sage migrate             从旧格式迁移文章
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ─── 找到博客项目根目录（当前目录或向上查找） ──────────
function findBlogDir() {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'site.config.js'))) return dir
    if (fs.existsSync(path.join(dir, 'build.js'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const BLOG_DIR = findBlogDir()
const CONTENT_DIR = path.join(BLOG_DIR, 'content')
const DIST_DIR = path.join(BLOG_DIR, 'dist')

// 读取站点配置（如果存在）
function loadConfig() {
  const configPath = path.join(BLOG_DIR, 'site.config.js')
  if (fs.existsSync(configPath)) {
    try { return require(configPath) } catch { return {} }
  }
  return {}
}

// ─── new: 创建新文章模板 ─────────────────────────────
function cmdNew(title) {
  if (!title) {
    console.error('❌ 请提供文章标题, 例: sage new "我的新文章"')
    process.exit(1)
  }

  fs.mkdirSync(CONTENT_DIR, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)
  const slug = generateSlug(title, today)
  const filePath = path.join(CONTENT_DIR, `${slug}.md`)

  if (fs.existsSync(filePath)) {
    console.error(`❌ 文件已存在: ${filePath}`)
    process.exit(1)
  }

  const template = `---
title: '${title}'
date: ${today}
tags: []
summary: ''
---

<!-- more -->
`

  fs.writeFileSync(filePath, template)
  console.log(`✅ 已创建文章模板: ${filePath}`)
  console.log(`   标题: ${title}`)
  console.log(`   日期: ${today}`)
  console.log(`   编辑后运行: sage build`)
}

// ─── build: 构建站点 ────────────────────────────────
function cmdBuild() {
  const buildScript = path.join(BLOG_DIR, 'build.js')
  if (!fs.existsSync(buildScript)) {
    console.error('❌ 找不到 build.js，请确认当前目录是博客项目根目录')
    process.exit(1)
  }
  require(buildScript)
}

// ─── preview: 本地预览 ──────────────────────────────
function cmdPreview(port = 8080) {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ 尚未构建，请先运行: sage build')
    process.exit(1)
  }

  console.log(`🌐 启动本地预览: http://localhost:${port}`)
  console.log('   按 Ctrl+C 停止')

  const { createServer } = require('http')
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
  }

  createServer((req, res) => {
    let urlPath = req.url.split('?')[0]
    if (urlPath === '/') urlPath = '/index.html'
    if (!urlPath.includes('.')) urlPath += '/index.html'

    const filePath = path.join(DIST_DIR, urlPath)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    const ext = path.extname(filePath)
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(res)
  }).listen(port, () => {
    console.log(`   http://localhost:${port}`)
  })
}

// ─── publish: Git 提交并推送 ────────────────────────
function cmdPublish(message) {
  const gitDir = path.join(BLOG_DIR, '.git')
  if (!fs.existsSync(gitDir)) {
    console.log('📦 初始化 Git 仓库...')
    execSync('git init', { cwd: BLOG_DIR, stdio: 'inherit' })
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.log('🔨 尚未构建，先运行构建...')
    cmdBuild()
  }

  const msg = message || `发布: ${new Date().toISOString().slice(0, 10)}`

  try {
    execSync('git add -A', { cwd: BLOG_DIR, stdio: 'inherit' })
    execSync(`git commit -m "${msg}"`, { cwd: BLOG_DIR, stdio: 'inherit' })

    try {
      execSync('git remote -v', { cwd: BLOG_DIR, stdio: 'pipe' })
      execSync('git push', { cwd: BLOG_DIR, stdio: 'inherit' })
      console.log('✅ 推送完成! Cloudflare Pages 将自动构建部署。')
    } catch {
      console.log('⚠️  未配置远程仓库。请添加远程仓库后推送:')
      console.log('   git remote add origin <your-repo-url>')
      console.log('   git push -u origin main')
    }
  } catch (e) {
    console.error('❌ 发布失败:', e.message)
  }
}

// ─── status: 查看站点状态 ───────────────────────────
function cmdStatus() {
  let matter
  try { matter = require('gray-matter') } catch {
    console.error('❌ 缺少依赖，请运行: npm install')
    process.exit(1)
  }

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error('❌ 找不到内容目录，请确认当前目录是博客项目根目录')
    process.exit(1)
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))

  let totalPosts = 0
  let totalDrafts = 0
  const tagCount = new Map()
  let latestPost = null

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8')
    const { data } = matter(raw)

    if (data.draft) { totalDrafts++; continue }

    totalPosts++
    for (const tag of (data.tags || [])) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
    }
    if (!latestPost || new Date(data.date) > new Date(latestPost.date)) {
      latestPost = { title: data.title, date: data.date, file }
    }
  }

  console.log('\n📊 博客状态')
  console.log('─'.repeat(40))
  console.log(`  📁 项目目录: ${BLOG_DIR}`)
  console.log(`  📄 已发布文章: ${totalPosts} 篇`)
  console.log(`  📝 草稿: ${totalDrafts} 篇`)
  console.log(`  🏷️  标签数: ${tagCount.size} 个`)

  if (totalPosts > 0) {
    console.log(`\n  🕐 最新文章:`)
    console.log(`     ${latestPost.title} (${formatDate(latestPost.date)})`)
  }

  if (fs.existsSync(DIST_DIR)) {
    const stat = fs.statSync(DIST_DIR)
    console.log(`\n  🏗️  构建输出: ${DIST_DIR}`)
    console.log(`     最后构建: ${stat.mtime.toLocaleString('zh-CN')}`)
  } else {
    console.log(`\n  ⚠️  尚未构建，运行: sage build`)
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: BLOG_DIR, encoding: 'utf-8' }).trim()
    const status = execSync('git status --short', { cwd: BLOG_DIR, encoding: 'utf-8' }).trim()
    console.log(`\n  🔀 Git 分支: ${branch}`)
    if (status) {
      console.log('     未提交变更:')
      status.split('\n').forEach(l => console.log(`     ${l}`))
    } else {
      console.log('     工作区干净')
    }
  } catch {
    console.log(`\n  ⚠️  未初始化 Git 仓库`)
  }

  if (tagCount.size > 0) {
    console.log(`\n  🏷️  标签统计 (Top 10):`)
    const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    for (const [tag, count] of sorted) {
      console.log(`     ${tag}: ${count} 篇`)
    }
  }

  console.log('─'.repeat(40) + '\n')
}

// ─── migrate: 从旧格式迁移 ────────────────────────
function cmdMigrate() {
  const config = loadConfig()
  const legacyDir = path.resolve(BLOG_DIR, config.legacyPostsDir || '../posts')

  if (!fs.existsSync(legacyDir)) {
    console.error(`❌ 找不到旧文章目录: ${legacyDir}`)
    process.exit(1)
  }

  let matter
  try { matter = require('gray-matter') } catch {
    console.error('❌ 缺少依赖，请运行: npm install')
    process.exit(1)
  }

  const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.md'))
  let migrated = 0
  let skipped = 0

  fs.mkdirSync(CONTENT_DIR, { recursive: true })

  for (const file of files) {
    const raw = fs.readFileSync(path.join(legacyDir, file), 'utf-8')
    const { data, content } = matter(raw)

    if (data.published === false) {
      console.log(`  ⏭️  跳过 (未发布): ${data.title || file}`)
      skipped++; continue
    }

    const slug = file.replace(/\.md$/, '')
    const targetPath = path.join(CONTENT_DIR, `${slug}.md`)

    if (fs.existsSync(targetPath)) {
      console.log(`  ⏭️  已存在: ${slug}`)
      skipped++; continue
    }

    let summary = data.summary || ''
    if (!summary) {
      const moreIdx = content.indexOf('<!-- more -->')
      if (moreIdx !== -1) {
        summary = content.slice(0, moreIdx).replace(/[#*`>\-\[\]()!|]/g, '').trim().slice(0, 150)
      } else {
        summary = content.replace(/[#*`>\[\]()!|]/g, '').trim().slice(0, 150)
      }
    }

    const newData = {
      title: data.title || slug,
      date: data.date || new Date().toISOString().slice(0, 10),
      tags: data.tags || [],
      summary,
    }

    if (data.hideInList === true) newData.type = 'about'

    const newContent = matter.stringify(content.replace('<!-- more -->', '<!-- more -->'), newData)
    fs.writeFileSync(targetPath, newContent)

    console.log(`  ✅ 迁移: ${data.title || slug}`)
    migrated++
  }

  console.log(`\n🎉 迁移完成! 成功 ${migrated} 篇, 跳过 ${skipped} 篇`)
  console.log(`   输出目录: ${CONTENT_DIR}`)
}

// ─── 工具函数 ───────────────────────────────────────
function generateSlug(title, dateStr) {
  const datePart = dateStr.replace(/-/g, '').slice(2)
  const asciiPart = title.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 40)
  if (asciiPart) return `${datePart}-${asciiPart}`
  return datePart
}

function slugify(text) {
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w一-龥\-]/g, '').slice(0, 100)
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── CLI 入口 ───────────────────────────────────────
const [,, command, ...args] = process.argv

switch (command) {
  case 'new':
    cmdNew(args.join(' '))
    break
  case 'build':
    cmdBuild()
    break
  case 'preview':
    cmdPreview(parseInt(args[0]) || 8080)
    break
  case 'publish':
    cmdPublish(args.join(' '))
    break
  case 'status':
    cmdStatus()
    break
  case 'migrate':
    cmdMigrate()
    break
  default:
    console.log(`
📝 sage - 极简博客 CLI 工具

用法:
  sage new [标题]          创建新文章模板
  sage build               构建静态站点
  sage preview [端口]      本地预览 (默认 8080)
  sage publish [消息]      Git 提交并推送
  sage status              查看站点状态
  sage migrate             从旧格式迁移文章

在博客项目根目录（含 site.config.js）下运行。
`)
    break
}