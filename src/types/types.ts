export interface QuerySmsCodeRequest {
  phone: string;
  scene: string;
}

export interface PostSmsLoginRequest {
  phone: string;
  code: string;
}