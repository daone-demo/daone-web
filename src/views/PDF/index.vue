<template>
    <div ref="containerRef" class="pdf-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';
import { useRoute } from 'vue-router';
import privacyPolicy from '@assets/pdf/PrivacyPolicy.pdf';
import userAgreement from '@assets/pdf/UserAgreement.pdf';
const route = useRoute();


pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const containerRef = ref<HTMLDivElement | null>(null)

const renderPdf = async () => {
    let pdfUrl = '';
    if (route.query.type === 'PrivacyPolicy') {
        pdfUrl = privacyPolicy
    }
    if (route.query.type === 'UserAgreement') {
        pdfUrl = userAgreement
    }
    if (!pdfUrl) return

    const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)

        const scale = 1.5
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) continue

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.className = 'pdf-canvas'

        containerRef.value?.appendChild(canvas)

        await page.render({
            canvas,
            canvasContext: context,
            viewport,
        }).promise
    }
}

watch(() => route.query.type, (newVal) => {
    if (newVal) {
        renderPdf()
    }
}, { immediate: true })
</script>

<style scoped>
.pdf-container {
    width: 100%;
    height: 100vh;
    overflow: auto;
    background: #f5f5f5;
    padding: 16px;
    box-sizing: border-box;
}

:deep(.pdf-canvas) {
    display: block;
    margin: 0 auto 16px;
    background: #fff;
    max-width: 100%;
}
</style>