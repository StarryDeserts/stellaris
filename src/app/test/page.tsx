"use client"

import { useState } from "react"
import SearchInput from "@/components/ui/Search"

export default function ExamplePage() {
  const [query, setQuery] = useState("")

  return (
    <div className="p-6">
      <h1 className="text-xl mb-4">搜索示例</h1>
      <SearchInput
        value={query}
        onChange={setQuery}                // 输入时触发（支持防抖）
        onSearch={(v) => console.log("搜索:", v)} // 回车或点放大镜触发
        placeholder="请输入关键字..."
      />

      <p className="mt-4">当前搜索内容: {query}</p>
    </div>
  )
}
