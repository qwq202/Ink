import { NextResponse } from "next/server"

const MODEL = "Qwen/Qwen2.5-7B-Instruct"
const API_URL = "https://api.qunqin.net/v1/chat/completions"

export async function POST(request: Request) {
  try {
    const { prompt, mode } = (await request.json()) as { prompt?: string; mode?: "txt2img" | "img2img" }
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "缺少 prompt" }, { status: 400 })
    }

    const apiKey = process.env.PROMPT_ENHANCE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "服务器未配置 PROMPT_ENHANCE_API_KEY" }, { status: 500 })
    }

    // 根据模式选择不同的系统提示
    const systemPrompts = {
      txt2img: `您是一个AI图像生成提示词优化助手。用户正在使用文字生成图片模式。

任务：优化用户的提示词，使其更适合从零开始生成全新图像。

优化重点：
1. 保持用户的语言（中文/英文），不要切换
2. 补充画面主体的细节描述（外观、姿态、表情等）
3. 添加场景环境描述（背景、地点、时间）
4. 添加艺术风格（写实、动漫、油画、3D渲染等）
5. 添加光照效果（自然光、工作室灯光、黄金时刻等）
6. 添加构图建议（特写、全景、鸟瞰等）
7. 添加氛围感受（温暖、神秘、活泼等）
8. 添加画质要求（高清、4K、细节丰富等）

仅输出优化后的提示词，不要添加任何解释说明。`,
      
      img2img: `您是一个AI图像编辑提示词优化助手。用户正在使用图生图模式，将基于已上传的原图进行修改。

任务：优化用户的提示词，使其更适合在现有图像基础上进行调整和改进。

优化重点：
1. 保持用户的语言（中文/英文），不要切换
2. 聚焦于要修改的具体方面（不要描述整体场景）
3. 指明要调整的元素（颜色、风格、氛围、细节等）
4. 描述期望的变化方向（增强、减弱、替换等）
5. 保持原图主体结构，只优化细节调整
6. 适当添加风格转换关键词（如转为油画风格、动漫风格等）
7. 可以指定要增强或保持的元素

注意：不要生成过于复杂的全新场景描述，因为原图已经提供了基础。
仅输出优化后的提示词，不要添加任何解释说明。`,
    }

    const systemContent = mode === "img2img" ? systemPrompts.img2img : systemPrompts.txt2img

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: `上游错误: ${response.status} ${text}` }, { status: 502 })
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ error: "未收到有效的优化结果" }, { status: 502 })
    }

    return NextResponse.json({ enhanced: content })
  } catch (error) {
    console.error("[prompt-enhance] error", error)
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
