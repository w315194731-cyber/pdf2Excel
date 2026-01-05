// src/app/page.tsx
"use client"; // 这一行其实可选，但为了保险加上

import dynamic from 'next/dynamic';

// 关键修复：使用 dynamic import 并关闭 SSR
// 这告诉 Next.js：不要在服务器加载这个组件，等到浏览器端再加载
const PdfProcessor = dynamic(
  () => import('@/components/PdfProcessor'),
  { 
    ssr: false, // 禁用服务器端渲染
    loading: () => (
      // 加载时的占位符，防止页面抖动
      <div className="w-full max-w-4xl mx-auto p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
        Initializing Secure PDF Engine...
      </div>
    )
  }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">
            Convert Bank Statements <span className="text-blue-600">Securely</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Processed 100% locally. No upload.
          </p>
        </div>
        
        {/* 加载动态组件 */}
        <PdfProcessor />
        
      </div>
    </main>
  );
}