"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./qr-scanner.module.css";

function extractTableCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    const match = url.pathname.match(/\/m\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {}
  return raw;
}

export default function QrScanner({ busy = false, onDetected }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const detectorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOpen(false);
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não liberou acesso à câmera. Use o código manual abaixo.");
      return;
    }
    if (!("BarcodeDetector" in window)) {
      setError("Leitura automática de QR não é suportada neste navegador. Use o código manual abaixo.");
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
      timerRef.current = window.setInterval(scanFrame, 450);
    } catch {
      stopCamera();
      setError("Não foi possível abrir a câmera. Verifique a permissão do navegador.");
    }
  }

  async function scanFrame() {
    if (!videoRef.current || videoRef.current.readyState < 2 || !detectorRef.current || busy) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      const code = extractTableCode(codes?.[0]?.rawValue);
      if (!code) return;
      stopCamera();
      await onDetected(code);
    } catch {}
  }

  async function submitManual(event) {
    event.preventDefault();
    const code = extractTableCode(manual);
    if (!code || busy) return;
    setManual("");
    await onDetected(code);
  }

  return <section className={styles.wrapper}>
    <div className={styles.scannerCard}>
      <div className={styles.scanIcon}><i/><i/><i/><i/></div>
      <div className={styles.copy}><strong>Ler QR Code da mesa</strong><span>Escaneie o QR fixo da mesa para se vincular à comanda aberta.</span></div>
      <button disabled={busy} onClick={open ? stopCamera : startCamera} type="button">{open ? "Fechar câmera" : busy ? "Vinculando..." : "Abrir câmera"}</button>
    </div>
    {open && <div className={styles.camera}><video muted playsInline ref={videoRef}/><div className={styles.frame}/></div>}
    {error && <p className={styles.error}>{error}</p>}
    <form className={styles.manual} onSubmit={submitManual}>
      <input onChange={(event) => setManual(event.target.value)} placeholder="Cole a URL do QR ou o código da mesa" value={manual}/>
      <button disabled={busy || !manual.trim()} type="submit">Vincular</button>
    </form>
  </section>;
}
