import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'ant-design-vue/dist/reset.css'
import './styles/iconfont.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupUserInfoAuthSync } from './stores/useUserInfo'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
setupUserInfoAuthSync()
app.use(router)
app.mount('#app')
