"use client";

import { useEffect, useMemo, useState } from "react";
import { qrSvgString } from "@/lib/qr-code";
import styles from "./table-qr.module.css";

const configuredBaseUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
const quietZone = 4;

export default function TableQr({ table }) {
  const [baseUrl, setBaseUrl] = useState(configuredBaseUrl);

  useEffect(() => {
    if (!configuredBaseUrl) setBaseUrl(window.location.origin.replace(/\/$/, ""));
  }, []);

  const url = baseUrl ? `${baseUrl}/m/${table.public_code}` : "";
  const qr = useMemo(() => {
    if (!url) return { svg: "", dataUrl: "", error: "" };
    try {
      const svg = qrSvgString(url, 10, quietZone);
      return { svg, dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, error: "" };
    } catch (error) {
      return { svg: "", dataUrl: "", error: error.message || "Não foi possível gerar o QR Code." };
    }
  }, [url]);
  const localhostWarning = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);

  function downloadQr() {
    if (!qr.svg || qr.error) return;
    const blob = new Blob([qr.svg], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `mesa-${String(table.number).padStart(2, "0")}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  return <div className={styles.wrapper}>
    <div className={styles.qr}>
      {qr.dataUrl ? <img alt={`QR Code da mesa ${table.number}`} src={qr.dataUrl} /> : <span>{qr.error ? "QR indisponível" : "Gerando QR..."}</span>}
    </div>
    <div className={styles.actions}>
      {url && !qr.error && <a href={url} rel="noreferrer" target="_blank">Testar cliente</a>}
      <button disabled={!url || Boolean(qr.error)} onClick={() => navigator.clipboard?.writeText(url)} type="button">Copiar</button>
      <button disabled={!url || Boolean(qr.error)} onClick={downloadQr} type="button">Baixar QR</button>
    </div>
    {qr.error && <small className={styles.warning}>{qr.error}</small>}
    {localhostWarning && !qr.error && <small className={styles.warning}>No celular, localhost não funciona. Abra o painel pelo endereço de rede ou configure NEXT_PUBLIC_APP_URL com o IP do computador.</small>}
  </div>;
}
