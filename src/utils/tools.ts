declare const wx: {
	getImageInfo: (options: {
		src: string
		success: (res: { path?: string }) => void
	}) => void
}

type TimeFormatType = 'Y-m-d' | 'h-m-s' | 'Y-m-d h:f' | 'h:m' | ''
type TimestampFormatType = 'MD' | 'HM' | 'MDHM' | 'YMD' | '-' | 'Y-M-D' | 'Y-M-D hh:mm:ss'

interface FormatTimeMsWithDays {
	days: string | number
	hours: string | number
	minutes: string | number
	seconds: string | number
	milliseconds: number
}

interface FormatTimeMsWithoutDays {
	hours: string | number
	minutes: string | number
	seconds: string | number
	milliseconds: number
}

type FormatTimeMsResult = FormatTimeMsWithDays | FormatTimeMsWithoutDays

function getCurrentTime(type: TimeFormatType | string = ''): string {
	const date = new Date()
	const y = date.getFullYear()
	const m = date.getMonth() + 1
	const mStr = m < 10 ? `0${m}` : String(m)
	const d = date.getDate()
	const dStr = d < 10 ? `0${d}` : String(d)
	const h = date.getHours()
	const hStr = h < 10 ? `0${h}` : String(h)
	const f = date.getMinutes()
	const fStr = f < 10 ? `0${f}` : String(f)
	const s = date.getSeconds()
	const sStr = s < 10 ? `0${s}` : String(s)

	if (type === 'Y-m-d') {
		return `${y}年${mStr}月${dStr}日`
	}
	if (type === 'h-m-s') {
		return `${dStr}时${fStr}分${sStr}秒`
	}
	if (type === 'Y-m-d h:f') {
		return `${y}-${mStr}-${dStr}  ${hStr}:${fStr}`
	}
	if (type === 'h:m') {
		return `${hStr}:${fStr}`
	}
	return `${y}${type}${mStr}${type}${dStr}${type}${hStr}${type}${fStr}${type}${sStr}`
}

/**
 * 默认  //毫秒数
 */
function formatTime(ms: number, type = ''): string {
	let days: number | string = Math.floor(ms / (1000 * 60 * 60 * 24))
	let hours: number | string = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
	let minutes: number | string = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
	let seconds: number | string = Math.floor((ms % (1000 * 60)) / 1000)

	if (Number(days) < 10) days = `0${days}`
	if (Number(hours) < 10) hours = `0${hours}`
	if (Number(minutes) < 10) minutes = `0${minutes}`
	if (Number(seconds) < 10) seconds = `0${seconds}`

	if (Number(days) > 0) {
		switch (type) {
			case 'HH': {
				let nowHours = String(hours)
				let nowDay = String(days)
				if (nowHours && nowHours.indexOf('0') === 0) {
					nowHours = nowHours.substr(1, 1)
				}
				if (nowDay && nowDay.indexOf('0') === 0) {
					nowDay = nowDay.substr(1, 1)
				}
				return `${Number(nowHours) + Number(nowDay) * 24}:${minutes}:${seconds}`
			}
			default:
				return `${days}天 ${hours}:${minutes}:${seconds}`
		}
	}
	return `${hours}:${minutes}:${seconds}`
}

/**
 * 获取对象的长度
 */
function objLength(input: unknown): number {
	let length = 0
	if (typeof input === 'object' && input !== null) {
		for (const key in input) {
			if (Object.prototype.hasOwnProperty.call(input, key) && typeof key !== 'number') {
				length++
			}
		}
	}
	return length
}

// 验证是否是手机号码
function vailPhone(number: string): boolean {
	const myreg = /^1[3-9][0-9]{9}$/
	return myreg.test(number)
}

// 过滤金钱currency(100, '￥', 3)==>￥100.000
function currency(
	value: number | string,
	_currency?: string | null,
	decimals?: number | null,
): string {
	const num = parseFloat(String(value))
	if (!isFinite(num) || (!num && num !== 0)) return ''
	const symbol = _currency != null ? _currency : '$'
	const decimalPlaces = decimals != null ? decimals : 2
	const stringified = Math.abs(num).toFixed(decimalPlaces)
	const _int = decimalPlaces ? stringified.slice(0, -1 - decimalPlaces) : stringified
	const i = _int.length % 3
	const head = i > 0 ? _int.slice(0, i) + (_int.length > 3 ? ',' : '') : ''
	const _float = decimalPlaces ? stringified.slice(-1 - decimalPlaces) : ''
	const sign = num < 0 ? '-' : ''
	const digitsRE = /(\d{3})(?=\d)/g
	return sign + symbol + head + _int.slice(i).replace(digitsRE, '$1,') + _float
}

// 浮点型减
function sub(a: number, b: number): number {
	let c = 0
	let d = 0
	try {
		c = a.toString().split('.')[1].length
	} catch {
		c = 0
	}
	try {
		d = b.toString().split('.')[1].length
	} catch {
		d = 0
	}
	const e = Math.pow(10, Math.max(c, d))
	return (mul(a, e) - mul(b, e)) / e
}

// 浮点型除法
function div(a: number, b: number): number {
	let e = 0
	let f = 0
	try {
		e = a.toString().split('.')[1].length
	} catch {
		// ignore
	}
	try {
		f = b.toString().split('.')[1].length
	} catch {
		// ignore
	}
	const c = Number(a.toString().replace('.', ''))
	const d = Number(b.toString().replace('.', ''))
	return mul(c / d, Math.pow(10, f - e))
}

// 浮点型加法函数
function accAdd(arg1: number, arg2: number): string {
	let r1 = 0
	let r2 = 0
	try {
		r1 = arg1.toString().split('.')[1].length
	} catch {
		r1 = 0
	}
	try {
		r2 = arg2.toString().split('.')[1].length
	} catch {
		r2 = 0
	}
	const m = Math.pow(10, Math.max(r1, r2))
	return ((arg1 * m + arg2 * m) / m).toFixed(2)
}

// 浮点型乘法
function mul(a: number, b: number): number {
	let c = 0
	const d = a.toString()
	const e = b.toString()
	try {
		c += d.split('.')[1].length
	} catch {
		// ignore
	}
	try {
		c += e.split('.')[1].length
	} catch {
		// ignore
	}
	return (Number(d.replace('.', '')) * Number(e.replace('.', ''))) / Math.pow(10, c)
}

// 遍历对象属性和值
function displayProp(obj: Record<string, unknown>): string {
	let names = ''
	for (const name in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, name)) {
			names += name + String(obj[name])
		}
	}
	return names
}

// 去除字符串所有空格
function sTrim(text: string): string {
	return text.replace(/\s/gi, '')
}

// 去除所有:
function replaceMaohao(txt: string): string {
	return txt.replace(/:/gi, '')
}

// 显示限定得字符串
function cutStr(strs: string | number, length = 3, type = 0): string {
	const str = String(strs)
	let flag = false

	if (type === 0) {
		let cutLength = length
		if (str.length < cutLength) {
			cutLength = str.length
			flag = true
		}
		const end = str.substr(0, cutLength)
		return flag ? end : `${end}...`
	}

	if (type === 1) {
		if (str.length > 4 && str.length < 8) {
			const end = div(Number(str), 10000)
			return `${end}万+`
		}
		return str
	}

	return str
}

// 时间戳转化为日期
function timestampToDate(timestamp: number, type: TimestampFormatType | string = 'YMD'): string {
	const date = new Date(timestamp)
	const year = date.getFullYear()
	let month: number | string = date.getMonth() + 1
	let day: number | string = date.getDate()
	let hour: number | string = date.getHours()
	let minute: number | string = date.getMinutes()
	let second: number | string = date.getSeconds()

	if (Number(month) < 10) month = `0${month}`
	if (Number(day) < 10) day = `0${day}`
	if (Number(hour) < 10) hour = `0${hour}`
	if (Number(minute) < 10) minute = `0${minute}`
	if (Number(second) < 10) second = `0${second}`

	if (type === 'MD') return `${month}-${day}`
	if (type === 'HM') return `${hour}:${minute}`
	if (type === 'MDHM') return `${month}-${day} ${hour}:${minute}`
	if (type === 'YMD') return `${year}年${month}月${day}日`
	if (type === '-') return `${year}-${month}-${day}`
	if (type === 'Y-M-D') return `${year}-${month}-${day}`
	if (type === 'Y-M-D hh:mm:ss') return `${year}-${month}-${day} ${hour}:${minute}:${second}`

	return `${year}年${month}月${day}日`
}

function tofixed(num: number, s: number): string {
	const times = Math.pow(10, s + 1)
	const des = parseInt(String(num * times), 10)
	const rest = des % 10
	if (rest === 5) {
		return ((parseFloat(String(des)) + 1) / times).toFixed(s)
	}
	return num.toFixed(s)
}

// 微信版本号
function compareVersion(v1: string, v2: string): number {
	const parts1 = v1.split('.')
	const parts2 = v2.split('.')
	const len = Math.max(parts1.length, parts2.length)

	while (parts1.length < len) {
		parts1.push('0')
	}
	while (parts2.length < len) {
		parts2.push('0')
	}

	for (let i = 0; i < len; i++) {
		const num1 = parseInt(parts1[i], 10)
		const num2 = parseInt(parts2[i], 10)
		if (num1 > num2) return 1
		if (num1 < num2) return -1
	}
	return 0
}

// 格式化毫秒
function formatTimeMs(ms: number, type = ''): FormatTimeMsResult {
	let days: number | string = Math.floor(ms / (1000 * 60 * 60 * 24))
	let hours: number | string = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
	let minutes: number | string = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
	let seconds: number | string = Math.floor((ms % (1000 * 60)) / 1000)
	const milliseconds = parseInt(
		Math.floor((ms % (1000 * 60)) % 1000).toString().slice(0, 1),
		10,
	)

	if (Number(days) < 10) days = `0${days}`
	if (Number(hours) < 10) hours = `0${hours}`
	if (Number(minutes) < 10) minutes = `0${minutes}`
	if (Number(seconds) < 10) seconds = `0${seconds}`

	if (Number(days) > 0) {
		switch (type) {
			case 'HH': {
				let nowHours = String(hours)
				const nowDay = String(days)
				if (hours && nowHours.indexOf('0') === 0) {
					nowHours = nowHours.substr(1, 1)
				}
				let normalizedDay = nowDay
				if (normalizedDay && normalizedDay.indexOf('0') === 0) {
					normalizedDay = normalizedDay.substr(1, 1)
				}
				hours = Number(nowHours) + Number(normalizedDay) * 24
				return { hours, minutes, seconds, milliseconds }
			}
			default:
				return { days, hours, minutes, seconds, milliseconds }
		}
	}

	return { hours, minutes, seconds, milliseconds }
}

// 发表时间 几秒前 几分前 几小时前
function formatTimeBefore(time: string | number | Date): string {
	const ms = new Date().getTime() - new Date(time).getTime()
	const days = Math.floor(ms / (1000 * 60 * 60 * 24))
	const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
	const seconds = Math.floor((ms % (1000 * 60)) / 1000)

	if (days) return `${days}天前`
	if (hours) return `${hours}小时前`
	if (minutes) return `${minutes}分钟前`
	if (seconds) return `${seconds}秒前`
	return '刚刚'
}

// 发表时间 几天前
function formatDayBefore(time: number): number {
	const ms = new Date().getTime() - time
	return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * 自定义key
 */
function customKey(): number {
	return Date.now() + Math.random()
}

function debounce<T extends (...args: never[]) => unknown>(func: T, wait = 1000) {
	let timer: ReturnType<typeof setTimeout> | undefined
	return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			func.apply(this, args)
		}, wait)
	}
}

function getDistanceSpecifiedTime(dateTime: string): string {
	const endTime = new Date(dateTime.replace(/-/g, '/'))
	const nowTime = new Date()
	const t = endTime.getTime() - nowTime.getTime()
	const d = Math.floor(t / 1000 / 60 / 60 / 24)
	const h = Math.floor((t / 1000 / 60 / 60) % 24)
	const m = Math.floor((t / 1000 / 60) % 60)
	const s = Math.floor((t / 1000) % 60)

	if (d > 0) {
		return `${d}天${h}时${m}分${s}秒`
	}
	return `${h}时${m}分${s}秒`
}

function toMoney(num: number | string): string {
	return Number(num).toFixed(2)
}

function isEmojiCharacter(substring: string): boolean {
	for (let i = 0; i < substring.length; i++) {
		const hs = substring.charCodeAt(i)
		if (hs >= 0xd800 && hs <= 0xdbff) {
			if (substring.length > 1) {
				const ls = substring.charCodeAt(i + 1)
				const uc = (hs - 0xd800) * 0x400 + (ls - 0xdc00) + 0x10000
				if (uc >= 0x1d000 && uc <= 0x1f77f) {
					return true
				}
			}
		} else if (substring.length > 1) {
			const ls = substring.charCodeAt(i + 1)
			if (ls === 0x20e3) {
				return true
			}
		} else if (
			(hs >= 0x2100 && hs <= 0x27ff) ||
			(hs >= 0x2b05 && hs <= 0x2b07) ||
			(hs >= 0x2934 && hs <= 0x2935) ||
			(hs >= 0x3297 && hs <= 0x3299) ||
			hs === 0xa9 ||
			hs === 0xae ||
			hs === 0x303d ||
			hs === 0x3030 ||
			hs === 0x2b55 ||
			hs === 0x2b1c ||
			hs === 0x2b1b ||
			hs === 0x2b50
		) {
			return true
		}
	}
	return false
}

function getAge(birthday: number): number {
	return new Date().getFullYear() - birthday
}

function getToDay(): number {
	const year = new Date().getFullYear()
	let month: number | string = new Date().getMonth() + 1
	let day: number | string = new Date().getDate()

	if (Number(month) < 10) month = `0${month}`
	if (Number(day) < 10) day = `0${day}`

	return new Date(`${year}-${month}-${day} 00:00:00`).getTime()
}

function getNextDay(): number {
	const year = new Date().getFullYear()
	let month: number | string = new Date().getMonth() + 1
	let day: number | string = new Date().getDate() + 1

	if (Number(month) < 10) month = `0${month}`
	if (Number(day) < 10) day = `0${day}`

	return new Date(`${year}-${month}-${day} 00:00:00`).getTime()
}

function formatTimes(ms: number): string {
	const date = new Date(ms)
	let month: number | string = date.getMonth() + 1
	month = month < 10 ? `0${month}` : month
	let day: number | string = date.getDate()
	day = day < 10 ? `0${day}` : day
	let hour: number | string = date.getHours()
	hour = hour < 10 ? `0${hour}` : hour
	let minute: number | string = date.getMinutes()
	minute = minute < 10 ? `0${minute}` : minute

	return `${month}-${day} ${hour}:${minute}`
}

function formatRichText(html: string | null | undefined): string {
	if (!html) return ''

	return html.replace(/<img[^>]*>/gi, (match) => {
		if (match.indexOf('style=') !== -1) {
			return match.replace(/style\s*?=\s*?(['"])[\s\S]*?\1/gi, 'style="width:100%;max-width:100%;height:auto;"')
		}
		const imageStyle = 'width:100%;max-width:100%;height:auto;'
		return match.replace(/<img/g, `<img style="${imageStyle}"`)
	})
}

function isPhoneNumber(phone: string): boolean {
	return /^1[3-9]\d{9}$/.test(phone)
}

function isEmail(email: string): boolean {
	return /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(email)
}

function maskPhoneNumber(phone: string): string {
	return phone ? phone.replace(/(\d{3})\d{4}(\d+)/, '$1****$2') : ''
}

function maskBankNumber(bankCardNumber: string): string {
	if (bankCardNumber && bankCardNumber.length > 10) {
		const frontFour = bankCardNumber.substring(0, 4)
		const backFour = bankCardNumber.substring(bankCardNumber.length - 4)
		const middle = '*'.repeat(8)
		return frontFour + middle + backFour
	}
	return bankCardNumber
}

function maskIdCard(idCard: string): string {
	if (idCard) {
		const frontFour = idCard.substring(0, 2)
		const backFour = idCard.substring(idCard.length - 2)
		const middle = '*'.repeat(idCard.length - 4)
		return frontFour + middle + backFour
	}
	return ''
}

function formatMoney(number: number | string): string {
	const arr = String(number).split('.')
	const int = arr[0].split('')
	const fraction = arr[1] || ''
	let r = ''

	int.reverse().forEach((v, i) => {
		if (i !== 0 && i % 3 === 0) {
			r = `${v},${r}`
		} else {
			r = v + r
		}
	})

	return r + (fraction ? `.${fraction}` : '')
}

// 获取微信图片信息 获取临时路径
const geWxtImageInfo = (url: string, callback: (path: string) => void): void => {
	if (url) {
		wx.getImageInfo({
			src: url,
			success: (res) => {
				callback(res.path ?? '')
			},
		})
	} else {
		callback('')
	}
}

const formatNumber = (n: number | string): string => {
	const str = n.toString()
	return str[1] ? str : `0${str}`
}

function formatLargeNumber(num: number): string {
	if (isNaN(num)) {
		return '0'
	}

	const fixedNum = num.toFixed(1)

	if (num >= 100000000) {
		const yi = num / 100000000
		return `${yi.toFixed(1)}亿`
	}
	if (num >= 10000) {
		const wan = num / 10000
		return `${wan.toFixed(1)}w`
	}
	if (num % 1 === 0) {
		return num.toString()
	}
	return fixedNum
}

export default {
	getCurrentTime,
	objLength,
	displayProp,
	sTrim,
	replaceMaohao,
	vailPhone,
	sub,
	div,
	mul,
	accAdd,
	currency,
	cutStr,
	formatTime,
	timestampToDate,
	tofixed,
	compareVersion,
	formatTimeMs,
	formatTimeBefore,
	formatDayBefore,
	customKey,
	debounce,
	getDistanceSpecifiedTime,
	toMoney,
	isEmojiCharacter,
	getAge,
	getToDay,
	getNextDay,
	formatTimes,
	formatRichText,
	isPhoneNumber,
	isEmail,
	maskPhoneNumber,
	maskBankNumber,
	maskIdCard,
	formatMoney,
	geWxtImageInfo,
	formatNumber,
	formatLargeNumber,
}

export type {
	TimeFormatType,
	TimestampFormatType,
	FormatTimeMsResult,
	FormatTimeMsWithDays,
	FormatTimeMsWithoutDays,
}
