// Adapted from nature-downloader browser_pdf_downloader.mjs and scripts/lib/pdf-utils.mjs.
// Copyright (c) 2026 baihe26. MIT license: vendor/nature-downloader/LICENSE.
// Modified: explicit existing tab only, same-origin URL, bounded transfer, no overwrite,
// PDF trailer and SHA readback; no page navigation, session export, or challenge handling.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MAX_BYTES = 100 * 1024 * 1024;
export async function inspectPdf(file) {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size < 1000) throw new Error('invalid_pdf');
  if (stat.size > MAX_BYTES) throw new Error('pdf_too_large');
  const bytes = await fs.readFile(file);
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new Error('invalid_pdf');
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function browserPdf({ proxy, target, url, destination }) {
  let endpoint, pdfUrl;
  try {
    endpoint = new URL(proxy); pdfUrl = new URL(url);
    if (/(?:token|ticket|password|cookie|secret|authorization|session|api[_-]?key|(?:[?&#])(?:code|state|key)=)/i.test(decodeURIComponent(pdfUrl.search + pdfUrl.hash))) throw new Error();
  } catch { throw new Error('invalid_download_request'); }
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password
    || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || !['http:', 'https:'].includes(pdfUrl.protocol)
    || pdfUrl.username || pdfUrl.password || typeof target !== 'string' || !target || target.length > 300) throw new Error('invalid_download_request');
  const signal = AbortSignal.timeout(60000);
  const evaluate = async (js, cleanup = false) => {
    const address = new URL('/eval', endpoint); address.searchParams.set('target', target);
    let response;
    try { response = await fetch(address, { method: 'POST', body: js, signal: cleanup ? AbortSignal.timeout(3000) : signal, redirect: 'error' }); }
    catch { throw new Error(signal.aborted ? 'download_timeout' : 'browser_unavailable'); }
    if (!response.ok) throw new Error('browser_unavailable');
    return (await response.json()).value;
  };
  const slot = '__dlcPdf_' + randomUUID().replaceAll('-', '');
  const temporary = destination + '.' + randomUUID() + '.tmp';
  let handle;
  try {
    const metadata = await evaluate(`(async()=>{
      if(location.origin!==${JSON.stringify(pdfUrl.origin)}) return {error:'browser_page_changed'};
      try {
        const response=await fetch(${JSON.stringify(pdfUrl.href)},{credentials:'include',signal:AbortSignal.timeout(45000)});
        if(!response.ok) return {error:response.status===401||response.status===403?'download_forbidden':'download_failed'};
        if(Number(response.headers.get('content-length'))>${MAX_BYTES}) return {error:'pdf_too_large'};
        const reader=response.body.getReader(), chunks=[]; let size=0;
        while(true){const {value,done}=await reader.read(); if(done) break; size+=value.length;
          if(size>${MAX_BYTES}){await reader.cancel();return {error:'pdf_too_large'};} chunks.push(value);}
        const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-') return {error:'invalid_pdf'};
        window[${JSON.stringify(slot)}]=bytes; return {size};
      } catch {return {error:'download_failed'};}
    })()`);
    if (metadata?.error) throw new Error(metadata.error);
    if (!Number.isInteger(metadata?.size) || metadata.size < 1000 || metadata.size > MAX_BYTES) throw new Error('invalid_pdf');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    handle = await fs.open(temporary, 'wx');
    for (let offset = 0; offset < metadata.size; offset += 262144) {
      const end = Math.min(offset + 262144, metadata.size);
      const base64 = await evaluate(`(()=>{const bytes=window[${JSON.stringify(slot)}]?.slice(${offset},${end});
        if(!bytes)return null;let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);})()`);
      if (typeof base64 !== 'string') throw new Error('browser_page_changed');
      const chunk = Buffer.from(base64, 'base64');
      if (chunk.length !== end - offset) throw new Error('invalid_pdf');
      await handle.writeFile(chunk);
    }
    await handle.close(); handle = null;
    const result = await inspectPdf(temporary);
    // A hard link publishes the fully written file atomically and refuses an existing destination.
    await fs.link(temporary, destination);
    if ((await inspectPdf(destination)).sha256 !== result.sha256) throw new Error('downloaded_pdf_changed');
    return { pdf: destination, ...result };
  } finally {
    if (handle) await handle.close();
    await fs.rm(temporary, { force: true });
    await evaluate(`delete window[${JSON.stringify(slot)}]`, true).catch(() => {});
  }
}
