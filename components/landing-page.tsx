"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NewImageGenerator } from "@/components/new-image-generator"
import {
  Sparkles,
  Wand2,
  Zap,
  Palette,
  Image as ImageIcon,
  ArrowRight,
  Github,
  Settings,
  Play,
  Star,
  Download,
  Users,
  Globe,
} from "lucide-react"
import { SettingsDialog } from "@/components/settings-dialog"

export function LandingPage() {
  const [showGenerator, setShowGenerator] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  if (showGenerator) {
    return <NewImageGenerator onBack={() => setShowGenerator(false)} />
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* 极简背景 - 仅保留微妙的点阵装饰 */}
      <div className="pointer-events-none fixed inset-0">
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* 极简导航栏 */}
      <nav className="relative z-10 border-b border-gray-100 bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gray-900">AI</span>
              <span className="text-gray-400"> Image</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              设置
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              asChild
            >
              <a
                href="https://github.com/qwq202/ai-image"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* 极简Hero区域 */}
      <section className="relative z-10 px-6 py-24 sm:py-32">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col items-center text-center">
            {/* 简洁标签 */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5">
              <span className="text-xs font-medium text-gray-600">
                AI 图像生成工具
              </span>
            </div>

            {/* 极简标题 */}
            <h1 className="mb-6 max-w-3xl text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              让 AI 帮你
              <br />
              创造视觉内容
            </h1>

            {/* 简洁副标题 */}
            <p className="mb-12 max-w-2xl text-lg text-gray-600 sm:text-xl">
              支持多个 AI 供应商的专业图像生成平台
            </p>

            {/* 简洁按钮组 */}
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setShowGenerator(true)}
                className="h-12 gap-2 rounded-lg bg-gray-900 px-8 text-base font-medium text-white hover:bg-gray-800"
              >
                开始创作
                <ArrowRight className="h-4 w-4" />
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                className="h-12 gap-2 rounded-lg border-2 border-gray-300 bg-white px-8 text-base font-medium text-gray-900 hover:border-gray-900 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
                配置设置
              </Button>
            </div>

            {/* 极简统计 */}
            <div className="mt-20 grid grid-cols-3 gap-12 border-t border-gray-100 pt-12">
              <div className="flex flex-col items-center">
                <div className="mb-2 text-3xl font-bold text-gray-900">5+</div>
                <div className="text-sm text-gray-500">AI 供应商</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="mb-2 text-3xl font-bold text-gray-900">20+</div>
                <div className="text-sm text-gray-500">AI 模型</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="mb-2 text-3xl font-bold text-gray-900">∞</div>
                <div className="text-sm text-gray-500">创意可能</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 极简特性区域 */}
      <section className="relative z-10 px-6 py-20 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              核心功能
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              专业的 AI 图像生成工具集
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* 特性卡片 1 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <Wand2 className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">文本生图</h3>
              <p className="text-gray-600 leading-relaxed">
                输入文字描述，AI 自动生成精美图片，支持多种尺寸和风格
              </p>
            </div>

            {/* 特性卡片 2 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <Palette className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">图片编辑</h3>
              <p className="text-gray-600 leading-relaxed">
                上传图片进行 AI 编辑，实现风格转换、内容修改等高级功能
              </p>
            </div>

            {/* 特性卡片 3 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <Zap className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">多供应商支持</h3>
              <p className="text-gray-600 leading-relaxed">
                支持 FAL、OpenAI、NewAPI 等多个 AI 平台，自由切换
              </p>
            </div>

            {/* 特性卡片 4 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <ImageIcon className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">批量生成</h3>
              <p className="text-gray-600 leading-relaxed">
                一次生成多张图片，提高创作效率，快速找到满意的作品
              </p>
            </div>

            {/* 特性卡片 5 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <Settings className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">参数控制</h3>
              <p className="text-gray-600 leading-relaxed">
                精细调整生成参数，包括尺寸、数量、种子值等高级选项
              </p>
            </div>

            {/* 特性卡片 6 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <Download className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">历史记录</h3>
              <p className="text-gray-600 leading-relaxed">
                自动保存生成历史，方便随时查看和下载之前的作品
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 极简CTA区域 */}
      <section className="relative z-10 px-6 py-20">
        <div className="container mx-auto max-w-3xl">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              准备开始创作了吗？
            </h2>
            
            <p className="mb-8 text-lg text-gray-600">
              立即体验 AI 图像生成的魅力
            </p>
            
            <Button
              size="lg"
              onClick={() => setShowGenerator(true)}
              className="h-12 gap-2 rounded-lg bg-gray-900 px-8 text-base font-medium text-white hover:bg-gray-800"
            >
              开始创作
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* 极简Footer */}
      <footer className="relative z-10 border-t border-gray-100 bg-white">
        <div className="container mx-auto px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* 品牌区域 */}
            <div className="lg:col-span-2">
              <div className="mb-4">
                <h2 className="text-2xl font-bold tracking-tight">
                  <span className="text-gray-900">AI</span>
                  <span className="text-gray-400"> Image</span>
                </h2>
              </div>
              <p className="mb-4 max-w-md text-gray-600 leading-relaxed">
                专业的 AI 图像生成平台，支持多个 AI 供应商
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  asChild
                >
                  <a
                    href="https://github.com/qwq202/ai-image"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <Github className="h-4 w-4 mr-1" />
                    GitHub
                  </a>
                </Button>
              </div>
            </div>

            {/* 功能链接 */}
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900">功能</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">文本生图</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">图片编辑</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">批量生成</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">历史管理</a></li>
              </ul>
            </div>

            {/* 支持链接 */}
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900">支持</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">使用指南</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">API 文档</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">常见问题</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">联系我们</a></li>
              </ul>
            </div>
          </div>

          {/* 版权信息 */}
          <div className="mt-12 border-t border-gray-100 pt-8 text-center">
            <p className="text-sm text-gray-500">
              © 2024 AI Image Tool. 基于多个 AI 平台构建的图像生成工具。
            </p>
          </div>
        </div>
      </footer>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
