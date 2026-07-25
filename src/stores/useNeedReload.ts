import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useNeedReloadStore = defineStore('needReload', () => {
    const needReload = ref(false);
    function setNeedReload(value: boolean) {
        needReload.value = value;
    }
    function getNeedReload() {
        return needReload.value;
    }
    return {
        needReload,
        setNeedReload,
        getNeedReload,
    };
});

export const useNeedReloadPointsStore = defineStore('needReloadPoints', () => {
    const needReloadPoints = ref(false);
    function setNeedReloadPoints(value: boolean) {
        needReloadPoints.value = value;
    }
    function getNeedReloadPoints() {
        return needReloadPoints.value;
    }
    return {
        needReloadPoints,
        setNeedReloadPoints,
        getNeedReloadPoints,
    };
});