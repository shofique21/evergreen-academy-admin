<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { formatBytes } from '@/utils/formatters'

export interface UploadFileItem {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  progress: number
  error?: string
}

const props = withDefaults(
  defineProps<{
    accept?: string
    maxSizeMb?: number
    multiple?: boolean
    autoUpload?: boolean
    uploadUrl?: string
    disabled?: boolean
    label?: string
    hint?: string
  }>(),
  {
    accept: '.pdf,.xlsx,.csv,.jpg,.jpeg,.png',
    maxSizeMb: 5,
    multiple: false,
    autoUpload: false,
    uploadUrl: undefined,
    disabled: false,
    label: 'Upload Document',
    hint: 'Drag and drop your file here, or click to browse',
  }
)

const emit = defineEmits<{
  (e: 'files-selected', files: File[]): void
  (e: 'file-removed', file: UploadFileItem): void
  (e: 'upload-complete', files: UploadFileItem[]): void
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const fileList = ref<UploadFileItem[]>([])
const uploadError = ref<string | null>(null)

function triggerSelect() {
  if (props.disabled) return
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    processFiles(Array.from(target.files))
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  if (props.disabled) return
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    processFiles(Array.from(event.dataTransfer.files))
  }
}

function processFiles(incomingFiles: File[]) {
  uploadError.value = null
  const validFiles: File[] = []
  const maxBytes = props.maxSizeMb * 1024 * 1024

  for (const file of incomingFiles) {
    if (file.size > maxBytes) {
      uploadError.value = `File "${file.name}" exceeds the maximum allowed size of ${props.maxSizeMb} MB.`
      continue
    }

    const item: UploadFileItem = {
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
    }

    if (!props.multiple) {
      fileList.value = [item]
      validFiles.push(file)
      break
    } else {
      fileList.value.push(item)
      validFiles.push(file)
    }
  }

  if (validFiles.length > 0) {
    emit('files-selected', validFiles)
    if (props.autoUpload) {
      startSimulatedUpload()
    }
  }
}

function removeFile(item: UploadFileItem) {
  fileList.value = fileList.value.filter((f) => f.id !== item.id)
  emit('file-removed', item)
}

function startSimulatedUpload() {
  fileList.value.forEach((item) => {
    item.status = 'uploading'
    let prog = 0
    const interval = setInterval(() => {
      prog += 20
      item.progress = Math.min(prog, 100)
      if (item.progress >= 100) {
        clearInterval(interval)
        item.status = 'completed'
        emit('upload-complete', fileList.value)
      }
    }, 150)
  })
}
</script>

<template>
  <div class="app-upload-container">
    <input
      ref="fileInput"
      type="file"
      class="hidden-file-input"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="handleFileChange"
    />

    <!-- Dropzone Area -->
    <div
      class="upload-dropzone"
      :class="{
        'is-dragging': isDragging,
        'is-disabled': disabled,
        'has-error': !!uploadError,
      }"
      @click="triggerSelect"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      role="button"
      tabindex="0"
      :aria-label="label"
    >
      <div class="dropzone-icon">
        <i class="pi pi-cloud-upload"></i>
      </div>
      <div class="dropzone-text">
        <span class="dropzone-title">{{ label }}</span>
        <span class="dropzone-hint">{{ hint }}</span>
        <span class="dropzone-formats">
          Accepted formats: {{ accept }} (Max {{ maxSizeMb }}MB)
        </span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="uploadError" class="upload-error-alert" role="alert">
      <i class="pi pi-exclamation-circle"></i>
      <span>{{ uploadError }}</span>
    </div>

    <!-- Uploaded Files List -->
    <div v-if="fileList.length > 0" class="file-items-list">
      <div
        v-for="item in fileList"
        :key="item.id"
        class="file-item-card"
        :class="`status-${item.status}`"
      >
        <div class="file-item-icon">
          <i
            :class="[
              item.status === 'completed'
                ? 'pi pi-check text-emerald-600'
                : item.status === 'error'
                ? 'pi pi-times text-red-600'
                : 'pi pi-file text-slate-500',
            ]"
          ></i>
        </div>

        <div class="file-item-info">
          <div class="file-name-row">
            <span class="file-name" :title="item.name">{{ item.name }}</span>
            <span class="file-size">{{ formatBytes(item.size) }}</span>
          </div>

          <ProgressBar
            v-if="item.status === 'uploading'"
            :value="item.progress"
            class="upload-progress-bar"
            :showValue="false"
          />
        </div>

        <button
          type="button"
          class="file-remove-btn"
          aria-label="Remove file"
          @click.stop="removeFile(item)"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>

      <div v-if="!autoUpload && fileList.some((f) => f.status === 'pending')" class="upload-actions">
        <Button
          label="Start Upload"
          icon="pi pi-upload"
          size="small"
          severity="primary"
          @click="startSimulatedUpload"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-upload-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.hidden-file-input {
  display: none;
}

.upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.75rem 1.25rem;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.upload-dropzone:hover:not(.is-disabled) {
  border-color: #059669;
  background: #ecfdf5;
}

.upload-dropzone.is-dragging {
  border-color: #059669;
  background: #d1fae5;
  transform: scale(1.01);
}

.upload-dropzone.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-dropzone.has-error {
  border-color: #ef4444;
  background: #fef2f2;
}

.dropzone-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  color: #059669;
}

.dropzone-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dropzone-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.dropzone-hint {
  font-size: 0.825rem;
  color: #64748b;
}

.dropzone-formats {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.upload-error-alert {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.file-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.file-item-icon {
  font-size: 1.1rem;
}

.file-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow: hidden;
}

.file-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.file-name {
  font-size: 0.825rem;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.75rem;
  color: #94a3b8;
  white-space: nowrap;
}

.upload-progress-bar {
  height: 4px !important;
}

.file-remove-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.file-remove-btn:hover {
  color: #ef4444;
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}
</style>
