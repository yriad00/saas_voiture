"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ name = "signature_data", required = true }: { name?: string; required?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [signatureData, setSignatureData] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 180;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.scale(ratio, ratio); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#111827"; }
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { event.currentTarget.setPointerCapture(event.pointerId); const p = point(event); const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return; ctx.beginPath(); ctx.moveTo(p.x, p.y); drawingRef.current = true; setEmpty(false); };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawingRef.current) return; const p = point(event); const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const end = () => { drawingRef.current = false; const canvas = canvasRef.current; if (canvas) setSignatureData(canvas.toDataURL("image/png")); };
  const clear = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); setSignatureData(""); setEmpty(true); };

  return <div className="space-y-2"><div className="relative overflow-hidden rounded-lg border bg-white"><canvas ref={canvasRef} className="h-44 w-full touch-none" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Zone de signature" />{empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-400"><PenLine className="size-4" /> Signez ici avec votre doigt</div>}</div><div className="flex items-center justify-between"><input type="text" className="sr-only" name={name} value={signatureData} readOnly required={required} /><Button type="button" variant="ghost" size="sm" onClick={clear}><Eraser className="size-3.5" /> Effacer</Button></div></div>;
}
