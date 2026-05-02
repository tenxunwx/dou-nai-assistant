const { publicUploadApiUrl, publicUploadOutputFormat, publicUploadCdnDomain } = require('../config/env')

const guessFileName = (url, fallback = 'generated-image') => {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname || ''
    const last = pathname.split('/').filter(Boolean).pop()
    return last || fallback
  } catch {
    return fallback
  }
}

const uploadToPublicGallery = async (sourceImageUrl) => {
  const sourceResp = await fetch(sourceImageUrl)
  if (!sourceResp.ok) {
    throw new Error(`下载生成图片失败: ${sourceResp.status}`)
  }
  const arrayBuffer = await sourceResp.arrayBuffer()
  const mimeType = sourceResp.headers.get('content-type') || 'image/png'
  const fileName = guessFileName(sourceImageUrl)

  const formData = new FormData()
  formData.append('image', new Blob([arrayBuffer], { type: mimeType }), fileName)
  if (publicUploadOutputFormat) formData.append('outputFormat', publicUploadOutputFormat)
  if (publicUploadCdnDomain) formData.append('cdn_domain', publicUploadCdnDomain)

  const uploadResp = await fetch(publicUploadApiUrl, {
    method: 'POST',
    body: formData,
  })

  let uploadData = {}
  try {
    uploadData = await uploadResp.json()
  } catch {
    uploadData = {}
  }

  if (!uploadResp.ok || uploadData?.success !== true || !uploadData?.url) {
    throw new Error(uploadData?.error || uploadData?.message || '上传公共图库失败')
  }

  return uploadData.url
}

module.exports = {
  uploadToPublicGallery,
}
