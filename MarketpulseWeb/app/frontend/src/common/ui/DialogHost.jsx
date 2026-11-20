/** openDialog · confirmDialog 로 연 대화상자를 그린다 — App 에 한 번만 올린다 */
import { Fragment, useEffect, useState } from 'react';
import Modal from './Modal';
import { subscribeDialogs } from './dialog';

const BUTTON_CLS =
  'inline-flex items-center h-8 px-4 rounded text-xs font-medium transition-colors';
const BUTTON_TONE = {
  primary:   'bg-cyan-600 hover:bg-cyan-500 text-white',
  danger:    'bg-red-600 hover:bg-red-500 text-white',
  secondary: 'bg-[var(--mp-raised)] hover:bg-[var(--mp-chip-on)] text-[var(--mp-text-2)]',
};

function ConfirmDialog({ title = '확인', message, okText = '확인', cancelText = '취소', danger = false, close }) {
  return (
    <Modal
      open
      onClose={() => close('cancel')}
      title={title}
      width="sm"
      bodyClassName="px-5 py-4 text-sm text-[var(--mp-text-2)] whitespace-pre-line"
      footer={(
        <>
          <button type="button" onClick={() => close('cancel')} className={`${BUTTON_CLS} ${BUTTON_TONE.secondary}`}>
            {cancelText}
          </button>
          {/* autoFocus — Enter 가 곧 확인 */}
          <button
            type="button"
            autoFocus
            onClick={() => close('ok')}
            className={`${BUTTON_CLS} ${danger ? BUTTON_TONE.danger : BUTTON_TONE.primary}`}
          >
            {okText}
          </button>
        </>
      )}
    >
      {message}
    </Modal>
  );
}

export default function DialogHost() {
  const [entries, setEntries] = useState([]);
  useEffect(() => subscribeDialogs(setEntries), []);

  return entries.map(({ id, render, close }) => (
    <Fragment key={id}>
      {typeof render === 'function'
        ? render(close)
        : render.kind === 'confirm' && <ConfirmDialog {...render} close={close} />}
    </Fragment>
  ));
}
