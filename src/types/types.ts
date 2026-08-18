/** 登录验证码 scene=login；试用申请与后端约定走通用短信接口 scene=TRIAL */
export type SmsCodeScene = 'login' | 'TRIAL'

export interface QuerySmsCodeRequest {
  phone: string;
  scene: SmsCodeScene;
}

export interface PostSmsLoginRequest {
  phone: string;
  code: string;
}