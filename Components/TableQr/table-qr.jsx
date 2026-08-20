"use client";

import { useMemo } from "react";
import { makeQrMatrix, qrSvgString } from "@/lib/qr-code";
import styles from "./table-qr.module.css";

function baseUrl() {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function TableQr({ table }) {
  const url = `${baseUrl()}/m/${table.public_code}`;
  const matrix = useMemo(() => url ? makeQrMatrix(url) : [], [url]);
  const localhostWarning = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);

  function downloadQr() {
    if (!url) return;
    const blob = new Blob([qrSvgString(url, 10, 4)], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `mesa-${String(table.number).padStart(2, "0")}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  return <div className={styles.wrapper}>
    <div className={styles.qr} aria-label={`QR Code da mesa ${table.number}`}>
      <svg viewBox={`0 0 ${matrix.length || 1} ${matrix.length || 1}`} shapeRendering="crispEdges" role="img">
        <rect width="100%" height="100%" fill="white" />
        {matrix.map((row, r) => row.map((dark, c) => dark ? <rect fill="black" height="1" key={`${r}-${c}`} width="1" x={c} y={r} /> : null))}
      </svg>
    </div>
    <div className={styles.actions}>
      <a href={url} rel="noreferrer" target="_blank">Testar cliente</a>
      <button onClick={() => navigator.clipboard?.writeText(url)} type="button">Copiar</button>
      <button onClick={downloadQr} type="button">Baixar QR</button>
    </div>
    {localhostWarning && <small className={styles.warning}>Para ler no celular em desenvolvimento, abra o painel pelo IP da rede ou configure NEXT_PUBLIC_APP_URL.</small>}
  </div>;
}
