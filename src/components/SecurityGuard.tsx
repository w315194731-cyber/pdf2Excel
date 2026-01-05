"use client";

import { useEffect } from "react";

export default function SecurityGuard() {
  useEffect(() => {
    // 1. 禁止右键菜单
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. 禁止常见的开发者工具快捷键 (F12, Ctrl+Shift+I, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" || 
        (e.ctrlKey && e.shiftKey && e.key === "I") || 
        (e.ctrlKey && e.shiftKey && e.key === "J") || 
        (e.ctrlKey && e.key === "U") // 查看源代码
      ) {
        e.preventDefault();
      }
    };

    // 3. 简单的调试器检测 (如果不怀好意的人强行打开了控制台，让代码变卡或清空)
    const checkDebugger = () => {
      const start = Date.now();
      // @ts-ignore
      debugger; // 如果控制台开启，这里会断点
      const end = Date.now();
      if (end - start > 100) {
        // 如果断点生效了，说明有人在调试
        document.body.innerHTML = "<h1>非法调试 / Debugging Detected</h1>";
        window.location.reload();
      }
    };

    // 只有在生产环境才启用这些恶心的功能
    if (process.env.NODE_ENV === "production") {
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("keydown", handleKeyDown);
      // 每秒检查一次
      const interval = setInterval(checkDebugger, 1000);
      return () => {
        document.removeEventListener("contextmenu", handleContextMenu);
        document.removeEventListener("keydown", handleKeyDown);
        clearInterval(interval);
      };
    }
  }, []);

  return null; // 这个组件不渲染任何东西
}