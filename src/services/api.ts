import { http } from '@/utils/request';
import type {
    QuerySmsCodeRequest,
    PostSmsLoginRequest
} from '@/types/types';

const api = {
    /**
     * 发送短信验证码
     * @param data 
     * @returns 
     */
  querySmsCode(data:QuerySmsCodeRequest) {
    return http.post('/auth/sms-codes', data)
  },
  postSmsLogin(data:PostSmsLoginRequest) {
    return http.post('/auth/sms-login', data)
  },
}

export default api;