/**
 * 코드에서 여는 대화상자 — BSHK shicObj.openPop 의 {code, data} 규약을 따른다.
 * 화면은 <DialogHost /> 가 그린다 (App 에 한 번 올려 둔다).
 *
 *   if (!(await confirmDialog({ message: '삭제하시겠습니까?', danger: true }))) return;
 *
 *   const { code, data } = await openDialog((close) => (
 *     <Modal open onClose={() => close('cancel')} title="종목 선택">
 *       <StockSelector onSelect={(s) => close('ok', s)} />
 *     </Modal>
 *   ));
 *   if (code === 'ok') use(data);
 *
 * code: 'ok' | 'cancel' (그 밖의 값도 화면이 정해 쓸 수 있다). 닫는 방법과 상관없이 Promise 는 한 번만 풀린다.
 */

let entries = [];
let seq = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(entries));
}

/** DialogHost 전용 — 열린 대화상자 목록을 구독한다 */
export function subscribeDialogs(fn) {
  listeners.add(fn);
  fn(entries);
  return () => listeners.delete(fn);
}

/**
 * render: (close) => JSX  — 직접 그리는 대화상자 (Modal 로 감싸서 돌려준다)
 *         { kind: 'confirm', … }  — DialogHost 가 아는 기본 대화상자
 * → Promise<{ code, data }>
 */
export function openDialog(render) {
  if (listeners.size === 0) {
    console.error('[dialog] <DialogHost /> 가 없어 대화상자를 열 수 없습니다 — App 에 올려 두세요');
    return Promise.resolve({ code: 'cancel' });
  }
  return new Promise((resolve) => {
    const id = ++seq;
    let done = false;
    const close = (code = 'cancel', data) => {
      if (done) return;
      done = true;
      entries = entries.filter((e) => e.id !== id);
      emit();
      resolve({ code, data });
    };
    entries = [...entries, { id, render, close }];
    emit();
  });
}

/**
 * 확인/취소 → Promise<boolean>. 문자열만 넘기면 message 로 쓴다.
 *   options: { title='확인', message, okText='확인', cancelText='취소', danger=false }
 */
export async function confirmDialog(options) {
  const opts = typeof options === 'string' ? { message: options } : options;
  const { code } = await openDialog({ kind: 'confirm', ...opts });
  return code === 'ok';
}
