import { el } from './dom';
import type { UiContext, ViewHandle } from './context';
import { renderSongToWav } from '../audio/offline-render';

function wavFilename(name: string): string {
  const base = name.trim().replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40) || 'song';
  return `${base}.wav`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function createIoView(ctx: UiContext): ViewHandle {
  const textarea = el('textarea', { placeholder: 'ここに曲データ(JSON)を貼り付けて「テキストから読み込み」' }) as HTMLTextAreaElement;
  const msg = el('div', { class: 'msg' });

  function setMsg(text: string, kind: 'ok' | 'err'): void {
    msg.textContent = text;
    msg.className = `msg ${kind}`;
  }

  const wavBtn = el('button', {
    text: 'WAV書き出し (音声ファイル)',
    onclick: async () => {
      const button = wavBtn as HTMLButtonElement;
      button.disabled = true;
      setMsg('音声をレンダリング中…', 'ok');
      try {
        const state = ctx.store.getState();
        const blob = await renderSongToWav(state);
        downloadBlob(blob, wavFilename(state.song.name));
        setMsg('WAV をダウンロードしました。', 'ok');
      } catch (err) {
        setMsg(`WAV 書き出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`, 'err');
      } finally {
        button.disabled = false;
      }
    },
  }) as HTMLButtonElement;

  const exportBtn = el('button', {
    text: 'エクスポート (ダウンロード)',
    onclick: () => {
      ctx.project.downloadExport();
      setMsg('JSON をダウンロードしました。', 'ok');
    },
  });

  const copyBtn = el('button', {
    text: 'JSON をテキスト欄に出力',
    onclick: () => {
      textarea.value = ctx.project.exportJsonString();
      setMsg('現在の曲を JSON として書き出しました(コピーできます)。', 'ok');
    },
  });

  const importBtn = el('button', {
    text: 'テキストから読み込み',
    onclick: () => {
      const result = ctx.project.importFromText(textarea.value);
      if (result.ok) setMsg('読み込み成功: 曲を復元しました。', 'ok');
      else setMsg(`読み込み失敗: ${result.error.message}${result.error.path ? ` (${result.error.path})` : ''}`, 'err');
    },
  });

  const fileInput = el('input', {
    type: 'file',
    accept: '.json,application/json',
    onchange: async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const result = await ctx.project.importFromFile(file);
      if (result.ok) setMsg(`読み込み成功: ${file.name}`, 'ok');
      else setMsg(`読み込み失敗: ${result.error.message}`, 'err');
      (e.target as HTMLInputElement).value = '';
    },
  });

  const root = el('div', { class: 'panel io' }, [
    el('h2', { text: 'エクスポート / インポート' }),
    el('div', { class: 'io-buttons' }, [wavBtn]),
    textarea,
    el('div', { class: 'io-buttons' }, [exportBtn, copyBtn, importBtn, fileInput]),
    msg,
  ]);

  return {
    el: root,
    update() {
      /* stateless display; textarea is user-controlled */
    },
  };
}
