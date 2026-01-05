// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, FileSpreadsheet, ShieldCheck, Trash2, Layers, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// 设置 Worker (指向 public 文件夹)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface ExtractedItem {
  text: string;
  x: number;
  y: number;
  page: number; // 新增：记录属于哪一页
}

export default function PdfProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [dividers, setDividers] = useState<number[]>([]); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [scale, setScale] = useState(1.5);
  const [totalPages, setTotalPages] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert("Please upload a PDF file");
      return;
    }
    setFileName(file.name);
    setIsProcessing(true);
    setDividers([]); 
    setItems([]); // 清空旧数据
    
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);
      await processPdf(typedarray);
    };
    fileReader.readAsArrayBuffer(file);
  };

  const processPdf = async (data: Uint8Array) => {
    try {
      const loadingTask = pdfjsLib.getDocument(data);
      const pdf = await loadingTask.promise;
      setTotalPages(pdf.numPages);

      let allItems: ExtractedItem[] = [];

      // 1. 渲染第一页 (用于可视化画线)
      const page1 = await pdf.getPage(1);
      const viewport = page1.getViewport({ scale });
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (context) {
          await page1.render({ canvasContext: context, viewport: viewport }).promise;
        }
      }

      // 2. 循环提取所有页面的数据 (后台处理)
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale }); // 确保坐标系一致

        const pageItems = textContent.items.map((item: any) => ({
          text: item.str,
          x: item.transform[4], 
          y: viewport.height - item.transform[5], 
          page: i
        }));

        allItems = [...allItems, ...pageItems];
      }

      // 过滤空字串
      setItems(allItems.filter(i => i.text.trim().length > 0));
      setIsProcessing(false);

    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      alert("Parse error");
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setDividers([...dividers, x]);
  };

  const removeLastDivider = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDividers(dividers.slice(0, -1));
  };

  // --- 核心算法：多页智能分列 ---
  const exportToSmartExcel = () => {
    if (items.length === 0) return;

    const sortedDividers = [...dividers].sort((a, b) => a - b);
    const finalRows: string[][] = [];

    // 添加表头 (可选)
    // finalRows.push(["Column 1", "Column 2", ...]);

    // 按页面分组处理
    for (let p = 1; p <= totalPages; p++) {
      const pageItems = items.filter(i => i.page === p);
      
      // 行分组算法 (Tolerance 10px)
      const rowMap = new Map<number, string[]>();
      const tolerance = 10; 

      pageItems.forEach(item => {
        // 1. 确定列 (根据用户画的红线)
        let colIndex = 0;
        for (let i = 0; i < sortedDividers.length; i++) {
          if (item.x > sortedDividers[i]) {
            colIndex = i + 1;
          }
        }

        // 2. 确定行 (模糊匹配 Y 坐标)
        let foundRowY = -1;
        for (const y of rowMap.keys()) {
          if (Math.abs(y - item.y) < tolerance) {
            foundRowY = y;
            break;
          }
        }

        if (foundRowY === -1) {
          foundRowY = item.y;
          rowMap.set(foundRowY, new Array(sortedDividers.length + 1).fill(""));
        }

        const currentRow = rowMap.get(foundRowY)!;
        currentRow[colIndex] = (currentRow[colIndex] + " " + item.text).trim();
      });

      // 当前页处理完毕，按 Y 坐标排序 (从上到下) 并加入总表
      const pageRows = Array.from(rowMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(entry => entry[1]);
      
      finalRows.push(...pageRows);
    }

    // 导出 Excel
    const ws = XLSX.utils.aoa_to_sheet(finalRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StatementData");
    XLSX.writeFile(wb, `${fileName.replace('.pdf', '')}_converted.xlsx`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      
      {/* 头部控制栏 */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">1. Define Columns</h2>
          <p className="text-slate-500 text-sm mt-1">
            Click on the document to draw red lines between columns (Date | Desc | Amount).
            <br/>These lines will apply to <span className="font-bold text-blue-600">ALL {totalPages} pages</span>.
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={removeLastDivider} className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium transition">
             <Trash2 size={16} /> Undo Line
           </button>
           <button 
              onClick={exportToSmartExcel}
              disabled={items.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 shadow-md font-medium disabled:opacity-50 transition-all hover:scale-105"
            >
              <FileSpreadsheet size={18} />
              Download Excel ({items.length} items)
            </button>
        </div>
      </div>

      {/* 主界面 */}
      <div className="flex gap-6">
        {/* PDF 交互区 */}
        <div className="flex-1 relative border-2 border-slate-200 border-dashed bg-slate-50 rounded-xl min-h-[600px] flex justify-center p-8 overflow-hidden">
          
          {!fileName && (
            <div className="absolute inset-0 flex items-center justify-center">
               <label className="cursor-pointer bg-white px-8 py-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center hover:bg-blue-50 transition group">
                  <div className="bg-blue-100 p-4 rounded-full mb-4 group-hover:bg-blue-200 transition">
                    <Upload className="w-8 h-8 text-blue-600" />
                  </div>
                  <span className="text-xl font-bold text-slate-800">Upload Bank Statement</span>
                  <span className="text-sm text-slate-400 mt-2">PDF files only • Local Processing</span>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
               </label>
            </div>
          )}

          {fileName && (
            <div 
              ref={containerRef} 
              className="relative cursor-crosshair shadow-2xl transition-shadow"
              onClick={handleCanvasClick}
              style={{ width: 'fit-content', height: 'fit-content' }}
            >
              {/* PDF Layer */}
              <canvas ref={canvasRef} className="block rounded-sm" />

              {/* Overlay Layer (Dividers) */}
              {dividers.map((x, i) => (
                <div 
                  key={i}
                  className="absolute top-0 bottom-0 w-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] pointer-events-none z-10"
                  style={{ left: x }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-6 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    Col {i + 2}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部状态栏 */}
      {fileName && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-50 p-2 rounded border">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Layers size={12}/> {totalPages} Pages</span>
            <span>{items.length} Text Items Detected</span>
          </div>
          <div>Processing Engine: PDF.js + WASM</div>
        </div>
      )}
    </div>
  );
}