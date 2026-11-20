/**
 * 짧은 알림 (BSHK shicObj.setStatusMsg 의 자리). react-hot-toast 를 직접 import 하지 말고 이걸 쓴다.
 * 화면은 <NotifyHost /> 가 그린다 (App 에 한 번).
 *
 *   notify.success('저장됨')
 *   notify.error('값을 입력하세요')
 *   notify.fail(e, '저장 실패')             // 오류 객체 → 문구 (errorMessage 규칙)
 *   notify.fail(e, '조회 실패', { provider }) // 오류에 provider 가 없을 때 쓸 이름
 */
import toast from 'react-hot-toast';
import { errorMessage } from '../api/errors';

export const notify = {
  success: (message, opts) => toast.success(message, opts),
  error:   (message, opts) => toast.error(message, opts),
  info:    (message, opts) => toast(message, opts),
  fail:    (err, fallback, { provider, ...opts } = {}) =>
    toast.error(errorMessage(err, fallback, { provider }), opts),
};
