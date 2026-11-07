import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { fmtDateTime, fmtDate } from '../utils/formatters';
import { Button, Badge } from './ui';
import { getApiBaseUrl, universalFetch } from '../services/api';

export default function FileDropzone({
  title,
  subtitle,
  badgeText,
  accept,
  accentColor = 'amber', // 'amber' for Binance, 'emerald' for Bank
  endpoint,
  maxSizeBytes = 25 * 1024 * 1024, // 25 MB por defecto
  onUploadSuccess,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const theme = accentColor === 'amber'
    ? {
        borderActive: 'border-amber-400 bg-amber-500/10',
        borderIdle: 'border-slate-800 hover:border-amber-500/50 bg-slate-900/60',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        iconBg: 'bg-amber-500/10 text-amber-400',
        button: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
      }
    : {
        borderActive: 'border-emerald-400 bg-emerald-500/10',
        borderIdle: 'border-slate-800 hover:border-emerald-500/50 bg-slate-900/60',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        iconBg: 'bg-emerald-500/10 text-emerald-400',
        button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
      };

  const handleFile = async (file) => {
    if (!file) return;

    // Validación defensiva en frontend: extensión y tamaño
    if (accept) {
      const allowedExts = accept
        .split(',')
        .map((ext) => ext.trim().toLowerCase())
        .filter(Boolean);
      const fileNameLower = file.name.toLowerCase();
      const isAllowed = allowedExts.some((ext) => fileNameLower.endsWith(ext));
      if (!isAllowed) {
        setError(`Formato de archivo inválido. Extensiones permitidas: ${accept}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    if (file.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      setError(`El archivo supera el tamaño máximo permitido (${maxMb} MB).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const targetUrl = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
      const response = await universalFetch(targetUrl, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Error al procesar el archivo');
      }
      setResult(data);
      if (onUploadSuccess) onUploadSuccess(data);
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el servidor FastAPI');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const resetZone = () => {
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme.iconBg}`}>
            {accentColor === 'amber' ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${theme.badge}`}>
          {badgeText}
        </span>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
          isDragging ? theme.borderActive : theme.borderIdle
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            <p className="text-sm font-medium text-slate-300">Analizando y normalizando registros...</p>
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-full bg-slate-800/80 p-3 text-slate-300 transition-transform group-hover:scale-105">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-200">
              Arrastra tu archivo aquí o <span className="underline decoration-slate-500 underline-offset-4">haz clic para explorar</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Procesamiento 100% local en memoria y SQLite ({accept})
            </p>
          </>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview Table & Counter */}
      {result && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-slate-200 truncate max-w-[220px]">
                {result.filename}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {result.total_pages !== undefined && (
                <Badge variant="default" size="xs">
                  {result.total_pages} pág.
                </Badge>
              )}
              <Badge variant="emerald" size="xs">
                {result.valid_rows} filas detectadas
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                icon={Trash2}
                onClick={(e) => {
                  e.stopPropagation();
                  resetZone();
                }}
                className="text-slate-400 hover:text-rose-400"
                title="Limpiar carga"
              />
            </div>
          </div>

          {result.preview && result.preview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    {accentColor === 'amber' ? (
                      <>
                        <th className="py-2 pr-3 font-medium">Orden</th>
                        <th className="py-2 px-2 font-medium">Tipo</th>
                        <th className="py-2 px-2 font-medium text-right">Monto Fiat</th>
                        <th className="py-2 px-2 font-medium text-right">USDT</th>
                        <th className="py-2 pl-2 font-medium">Fecha</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 pr-3 font-medium">Fecha</th>
                        <th className="py-2 px-2 font-medium">Ref.</th>
                        <th className="py-2 px-2 font-medium">Concepto</th>
                        <th className="py-2 px-2 font-medium text-right">Débito</th>
                        <th className="py-2 pl-2 font-medium text-right">Crédito</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-[11px] tabular-nums">
                  {result.preview.map((row, i) =>
                    accentColor === 'amber' ? (
                      <tr key={i} className="text-slate-300">
                        <td className="py-1.5 pr-3 text-slate-400 font-mono">{row.order_number.slice(-8)}</td>
                        <td className="py-1.5 px-2">
                          <Badge
                            variant={row.order_type === 'COMPRA' ? 'emerald' : 'amber'}
                            size="xs"
                          >
                            {row.order_type}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-right font-medium text-slate-100">
                          {Number(row.fiat_amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })} {row.fiat_currency}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-300">
                          {Number(row.crypto_amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 pl-2 text-slate-400 truncate max-w-[110px]">{fmtDateTime(row.order_date)}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="text-slate-300">
                        <td className="py-1.5 pr-3 text-slate-400">{fmtDate(row.tx_date)}</td>
                        <td className="py-1.5 px-2 text-amber-300/90 font-mono">{row.reference}</td>
                        <td className="py-1.5 px-2 font-sans text-slate-300 truncate max-w-[140px]">{row.description}</td>
                        <td className="py-1.5 px-2 text-right text-rose-400">
                          {row.debit > 0 ? Number(row.debit).toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-1.5 pl-2 text-right text-emerald-400">
                          {row.credit > 0 ? Number(row.credit).toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-500 text-right">
                Mostrando primeras {result.preview.length} de {result.valid_rows} filas detectadas
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Archivo recibido. Si no se visualizan filas, ajustaremos la plantilla del extractor para el formato específico de tu banco.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
