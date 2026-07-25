import { onBeforeUnmount, ref, type Ref } from 'vue'

export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remain = total % 60
  return `${minutes}:${remain.toString().padStart(2, '0')}`
}

export function getVideoResolutionLabel(height: number): string {
  if (!height) return '--'
  if (height >= 2160) return '2160P'
  if (height >= 1440) return '1440P'
  if (height >= 1080) return '1080P'
  if (height >= 720) return '720P'
  if (height >= 480) return '480P'
  return `${height}P`
}

export function useVideoPlayer(videoRef: Ref<HTMLVideoElement | null>) {
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const isMuted = ref(false)

  function onLoadedMetadata() {
    const video = videoRef.value
    if (!video) return
    duration.value = Number.isFinite(video.duration) ? video.duration : 0
    volume.value = video.volume
    isMuted.value = video.muted
  }

  function onTimeUpdate() {
    const video = videoRef.value
    if (!video) return
    currentTime.value = video.currentTime
    if (Number.isFinite(video.duration)) {
      duration.value = video.duration
    }
  }

  function onPlay() {
    isPlaying.value = true
  }

  function onPause() {
    isPlaying.value = false
  }

  function onEnded() {
    isPlaying.value = false
    currentTime.value = 0
  }

  async function play() {
    const video = videoRef.value
    if (!video) return
    try {
      await video.play()
      isPlaying.value = true
    } catch {
      // ignore autoplay restrictions
    }
  }

  function pause() {
    videoRef.value?.pause()
    isPlaying.value = false
  }

  function togglePlay() {
    if (isPlaying.value) {
      pause()
      return
    }
    void play()
  }

  function seek(time: number) {
    const video = videoRef.value
    if (!video || !Number.isFinite(time)) return
    const max = duration.value || video.duration || 0
    video.currentTime = Math.max(0, Math.min(time, max))
    currentTime.value = video.currentTime
  }

  function seekByRatio(ratio: number) {
    if (!duration.value) return
    seek(ratio * duration.value)
  }

  function setVolume(value: number) {
    const video = videoRef.value
    if (!video) return
    const next = Math.max(0, Math.min(1, value))
    video.volume = next
    volume.value = next
    if (next > 0) {
      video.muted = false
      isMuted.value = false
    }
  }

  function toggleMute() {
    const video = videoRef.value
    if (!video) return
    video.muted = !video.muted
    isMuted.value = video.muted
  }

  async function toggleFullscreen() {
    const video = videoRef.value
    if (!video) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    const target = video.parentElement ?? video
    await target.requestFullscreen?.()
  }

  function stop() {
    pause()
    seek(0)
  }

  onBeforeUnmount(() => {
    pause()
  })

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    onLoadedMetadata,
    onTimeUpdate,
    onPlay,
    onPause,
    onEnded,
    play,
    pause,
    togglePlay,
    seek,
    seekByRatio,
    setVolume,
    toggleMute,
    toggleFullscreen,
    stop,
    formatTime: formatVideoTime,
  }
}
