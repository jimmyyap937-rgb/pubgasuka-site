# SMK Dato Syed Esa 投稿墙

一个可以部署到 Vercel 的匿名/实名投稿墙网站：文字投稿、图片投稿、点赞排序、管理员删帖。

## 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。本地开发也需要先完成下面的 "接上数据库" 步骤，否则 API 会报错（因为还没有数据库）。

## 部署到 Vercel（跟着做，大概 5 分钟）

### 1. 把代码传到 GitHub

把这个文件夹初始化成一个 git 仓库并推到你自己的 GitHub：

```bash
cd wall-app
git init
git add .
git commit -m "init"
# 在 GitHub 新建一个空仓库后：
git remote add origin <你的仓库地址>
git push -u origin main
```

### 2. 在 Vercel 导入这个项目

去 https://vercel.com/new ，选择刚才推上去的 GitHub 仓库，点 Deploy（这一步会先失败/报错也没关系，因为还没接数据库，下一步接上就好）。

### 3. 给项目挂上一个 Redis 数据库（用来存投稿）

Vercel 自己的 KV 数据库已经下架了，现在官方推荐用 Marketplace 里的 **Upstash for Redis**（免费额度够这种小网站用）：

1. 打开你项目的 Vercel 后台 → **Storage** 标签
2. 点 **Create Database**（或 **Browse Marketplace**）→ 找到 **Upstash** → 选 **Redis**
3. 按提示创建数据库，选择 **Connect** 到你刚部署的这个项目
4. Vercel 会自动把 `KV_REST_API_URL`、`KV_REST_API_TOKEN` 等环境变量加到你的项目里（代码里读的就是这两个变量名，接好后不用改代码）

### 4. 设置管理员密码

项目 Settings → **Environment Variables**，新增一个：

- Key: `ADMIN_PASSCODE`
- Value: 你自己设的密码，例如 `esa2026`

### 5. 重新部署

Settings → Deployments → 找最新一次部署，点右边的 `···` → **Redeploy**（这样新的环境变量才会生效）。

完成后，你的投稿墙就是一个真正的网站了，任何人打开同一个网址，看到的都是同一面墙，数据存在 Vercel KV 里，不依赖任何浏览器本地存储。

## 功能说明

- **匿名 / 实名**投稿，文字 + 图片（图片会在浏览器里自动压缩后再上传）
- **最新 / 最热**两种排序，点赞存在数据库里，谁都能点
- **管理员删帖**：右上角「🔒 管理员」输入密码后，每张便条右上角出现删除按钮。密码校验在服务器端完成（`ADMIN_PASSCODE` 环境变量），不会暴露在浏览器代码里
- 单张便条限制：文字 600 字以内，图片压缩后约 900KB 以内
- 数据库里最多保留最新 300 张便条，超过会自动清掉最旧的（避免数据库无限变大）

## 如果想改进

- 想要更细的管理后台（操作记录、多个管理员账号）→ 需要接真正的用户认证（比如 NextAuth）
- 想要防灌水/防骚扰 → 可以加简单的内容过滤，或接一个人工审核队列（新投稿先进"待审核"，管理员批准后才显示在墙上）
- 图片多了以后数据库会变大 → 可以把图片改存到 **Vercel Blob**（专门存文件），数据库里只存图片链接
