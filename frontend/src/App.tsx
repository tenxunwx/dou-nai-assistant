import {
  ArrowUp,
  ChevronDown,
  Menu,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import type { MouseEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './apiFetch'

type CanvasImage = {
  id: string
  prompt: string
  size: string
  x: number
  y: number
  sourceImageId?: string
  status: 'generating' | 'completed' | 'failed'
  imageUrl: string | null
  error: string | null
  startedAt: number | null
  uploadedToGallery?: boolean
}

type CanvasItem = {
  id: string
  createdAt: string
  images: CanvasImage[]
}

const AUTH_STORAGE_KEY = 'wanmihuabu-auth'
const getLastCanvasStorageKey = (userId?: number) => `wanmihuabu-last-canvas-${userId || 'guest'}`
const getCanvasTrashStorageKey = (userId: number) => `wanmihuabu-canvas-trash-${userId}`
const getFactoryCanvasId = (userId: number) => `wm-factory-${userId}`
const isFactoryCanvasId = (id: string) => id.startsWith('wm-factory-')
const GENERATING_TEXTS = [
  '等待必将有好结果',
  '灵感正在加载中',
  '马上就好，再等一会',
  '生成中，别眨眼',
  '好的画面值得等待',
  'AI 正在认真创作',
  '正在渲染细节',
] as const

const FACTORY_IMAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1024x1024', label: '1:1' },
  { value: '1920x1080', label: '16:9' },
  { value: '1080x1920', label: '9:16' },
  { value: '1024x1792', label: '9:16(长)' },
]

type AuthUser = {
  id: number
  username: string
  role: 'admin' | 'user'
  avatarUrl?: string
  balanceCents?: number
  banned?: boolean
  email?: string | null
}

type AdminListUser = {
  id: number
  username: string
  role: string
  balanceCents: number
  banned: boolean
  avatarUrl?: string | null
  createdAt: string
}

type RechargeOrderRow = {
  id: number
  outTradeNo: string
  moneyCents: number
  payType: string
  status: string
  tradeNo: string | null
  createdAt: string
  paidAt: string | null
}

type BalanceHistoryRow = {
  kind: string
  at: string
  deltaCents: number
  label: string
  ref: string
}

const normalizeAuthRole = (role: unknown): 'admin' | 'user' =>
  String(role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user'

const normalizeAuthUser = (user: AuthUser): AuthUser => ({
  ...user,
  role: normalizeAuthRole(user.role),
})

function App() {
  const [isDark, setIsDark] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ripple, setRipple] = useState({ x: 0, y: 0, show: false })
  const [activeMenu, setActiveMenu] = useState<
    'dreamCanvas' | 'imageFactory' | 'records' | 'recharge' | 'system' | 'users'
  >(() => {
    if (typeof window === 'undefined') return 'dreamCanvas'
    return window.matchMedia('(max-width: 767px)').matches ? 'imageFactory' : 'dreamCanvas'
  })
  const [systemSubMenu, setSystemSubMenu] = useState<'interface' | 'system'>('interface')
  const [systemSettingsTab, setSystemSettingsTab] = useState<'general' | 'register' | 'payment'>('general')
  const [appSiteTitle, setAppSiteTitle] = useState('万米画布')
  const [payEnabled, setPayEnabled] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('0.5')
  const [rechargeError, setRechargeError] = useState('')
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false)
  const [rechargeOrders, setRechargeOrders] = useState<RechargeOrderRow[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminListUser[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [adminUsersError, setAdminUsersError] = useState('')
  const [userMgmtModal, setUserMgmtModal] = useState<
    null | { mode: 'balance' | 'history' | 'records'; user: AdminListUser }
  >(null)
  const [adminBalanceYuan, setAdminBalanceYuan] = useState('')
  const [adminBalanceNote, setAdminBalanceNote] = useState('')
  const [adminModalLoading, setAdminModalLoading] = useState(false)
  const [adminHistoryRows, setAdminHistoryRows] = useState<BalanceHistoryRow[]>([])
  const [adminGenRows, setAdminGenRows] = useState<
    Array<{
      id: number
      prompt: string
      model: string
      size: string
      status: string
      costCents: number
      errorMessage: string | null
      imageUrl: string | null
      createdAt: string
    }>
  >([])
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authToken, setAuthToken] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authRegisterEmail, setAuthRegisterEmail] = useState('')
  const [authRegisterCode, setAuthRegisterCode] = useState('')
  const [registerSendCooldown, setRegisterSendCooldown] = useState(0)
  const [registerSendBusy, setRegisterSendBusy] = useState(false)
  const [publicRegisterMode, setPublicRegisterMode] = useState<'default' | 'email_verification'>(
    'email_verification',
  )
  const [publicAllowRegister, setPublicAllowRegister] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [avatarPrompt, setAvatarPrompt] = useState('')
  const [avatarGenerating, setAvatarGenerating] = useState(false)
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null)
  const [avatarRepo, setAvatarRepo] = useState<Array<{ id: number; imageUrl: string; prompt: string; creatorUsername: string }>>([])
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null)
  const [avatarRemaining, setAvatarRemaining] = useState<number | null>(null)
  const [interfaceConfigs, setInterfaceConfigs] = useState<
    Array<{ id: number; baseUrl: string; model: string; unitCostCents: number }>
  >([])
  const [interfaceBaseUrl, setInterfaceBaseUrl] = useState('')
  const [interfaceApiKey, setInterfaceApiKey] = useState('')
  const [interfaceModel, setInterfaceModel] = useState('gpt-image-2')
  const [interfaceUnitCostYuan, setInterfaceUnitCostYuan] = useState('0.07')
  const [settingsError, setSettingsError] = useState('')
  const [systemSettings, setSystemSettings] = useState({
    siteTitle: '万米画布',
    payProvider: 'none' as 'none' | 'epay',
    epaySubmitUrl: '',
    epayPid: '',
    epayKey: '',
    epayKeySet: false,
    allowUserRegister: true,
    registerMode: 'email_verification' as 'default' | 'email_verification',
    emailProvider: 'custom' as 'custom' | 'qq',
    emailVerificationEnabled: true,
    smtpHost: '',
    smtpPort: '',
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    verifyFromEmail: '',
    emailSubjectTemplate: '【万米画布】邮箱验证码',
    emailHtmlTemplate:
      '<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>欢迎使用万米画布</h2><p>你的验证码是：<b>{{code}}</b></p><p>5分钟内有效，请勿泄露给他人。</p></div>',
    registerGiftYuan: '0',
  })
  const [showEmailTemplateEditor, setShowEmailTemplateEditor] = useState(false)
  const [generationRecords, setGenerationRecords] = useState<
    Array<{
      id: number
      prompt: string
      model: string
      size: string
      status: string
      costCents: number
      errorMessage: string | null
      imageUrl: string | null
      createdAt: string
    }>
  >([])
  const [savingCanvas, setSavingCanvas] = useState(false)
  const [canvases, setCanvases] = useState<CanvasItem[]>([])
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [promptText, setPromptText] = useState('')
  const [imageSize, setImageSize] = useState('1024x1024')
  const [imageModel, setImageModel] = useState('gpt-image-2')
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [referenceUploading, setReferenceUploading] = useState(false)
  const [referenceUploadError, setReferenceUploadError] = useState('')
  const [showPromptWindow, setShowPromptWindow] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showAlbumParserModal, setShowAlbumParserModal] = useState(false)
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [canvasTrashByCanvasId, setCanvasTrashByCanvasId] = useState<Record<string, CanvasImage[]>>({})
  const [albumInput, setAlbumInput] = useState('')
  const [albumParsing, setAlbumParsing] = useState(false)
  const [albumParseError, setAlbumParseError] = useState('')
  const [albumCandidates, setAlbumCandidates] = useState<string[]>([])
  const [selectedAlbumUrls, setSelectedAlbumUrls] = useState<string[]>([])
  const [albumImporting, setAlbumImporting] = useState(false)
  const [showCanvasSelector, setShowCanvasSelector] = useState(false)
  const [canvasSearch, setCanvasSearch] = useState('')
  const [isModifyMode, setIsModifyMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modifySourceImageId, setModifySourceImageId] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, originX: 0, originY: 0 })
  const canvasViewportRef = useRef<HTMLDivElement | null>(null)
  const factoryChatEndRef = useRef<HTMLDivElement | null>(null)
  const factoryMobilePickersRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const userMenuCloseTimerRef = useRef<number | null>(null)
  const [generatingTick, setGeneratingTick] = useState(0)
  const [factoryMobilePick, setFactoryMobilePick] = useState<null | 'size' | 'model'>(null)
  const [factoryImageLightbox, setFactoryImageLightbox] = useState<string | null>(null)

  useEffect(() => {
    if (!factoryImageLightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFactoryImageLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [factoryImageLightbox])

  useEffect(() => {
    if (!factoryMobilePick) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (factoryMobilePickersRef.current?.contains(event.target as Node)) return
      setFactoryMobilePick(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [factoryMobilePick])

  useEffect(() => {
    if (activeMenu !== 'imageFactory') {
      setFactoryMobilePick(null)
      setFactoryImageLightbox(null)
    }
    if (!isMobile) setFactoryMobilePick(null)
  }, [activeMenu, isMobile])

  useEffect(() => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { token: string; user: AuthUser }
      if (parsed?.token && parsed?.user) {
        setAuthToken(parsed.token)
        setAuthUser(normalizeAuthUser(parsed.user))
      }
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const loadSite = async () => {
      try {
        const r = await apiFetch('/api/site')
        if (!r.ok) return
        const d = (await r.json()) as {
          siteTitle?: string
          registerMode?: string
          allowUserRegister?: boolean
        }
        if (d?.siteTitle) setAppSiteTitle(String(d.siteTitle))
        setPublicRegisterMode(d.registerMode === 'email_verification' ? 'email_verification' : 'default')
        setPublicAllowRegister(d.allowUserRegister !== false)
      } catch {
        /* ignore */
      }
    }
    loadSite()
  }, [])

  useEffect(() => {
    if (registerSendCooldown <= 0) return
    const t = window.setInterval(() => {
      setRegisterSendCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [registerSendCooldown])

  useEffect(() => {
    if (!publicAllowRegister) setAuthMode('login')
  }, [publicAllowRegister])

  useEffect(() => {
    document.title = appSiteTitle
  }, [appSiteTitle])

  useEffect(() => {
    if (typeof window === 'undefined' || !authToken || !authUser) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('recharge') !== '1') return
    setActiveMenu('recharge')
    const refresh = async () => {
      try {
        const headers = { Authorization: `Bearer ${authToken}` }
        const [meResp, ordResp] = await Promise.all([
          apiFetch('/api/auth/me', { headers }),
          apiFetch('/api/pay/my-recharges', { headers }),
        ])
        if (meResp.ok) {
          const meData = await meResp.json()
          if (meData?.user) {
            const u = meData.user as Partial<AuthUser>
            saveUserProfile({
              ...authUser,
              role: u.role ?? authUser.role,
              avatarUrl: u.avatarUrl || authUser.avatarUrl,
              balanceCents: Number(u.balanceCents ?? 0),
            })
          }
        }
        if (ordResp.ok) {
          const ordData = (await ordResp.json()) as { items?: RechargeOrderRow[] }
          if (Array.isArray(ordData.items)) setRechargeOrders(ordData.items)
        }
      } catch {
        /* ignore */
      }
      const path = window.location.pathname || '/'
      window.history.replaceState({}, '', path)
    }
    void refresh()
  }, [authToken, authUser?.id])

  useEffect(() => {
    if (!authToken || activeMenu !== 'recharge') return
    const loadPay = async () => {
      try {
        const r = await apiFetch('/api/pay/config', { headers: { Authorization: `Bearer ${authToken}` } })
        if (!r.ok) {
          setPayEnabled(false)
          return
        }
        const d = await r.json()
        setPayEnabled(Boolean(d?.enabled))
      } catch {
        setPayEnabled(false)
      }
    }
    void loadPay()
  }, [authToken, activeMenu])

  useEffect(() => {
    if (!authToken || activeMenu !== 'recharge') return
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiFetch('/api/pay/my-recharges', { headers: { Authorization: `Bearer ${authToken}` } })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as { items?: RechargeOrderRow[] }
        if (!cancelled && Array.isArray(d.items)) setRechargeOrders(d.items)
      } catch {
        if (!cancelled) setRechargeOrders([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authToken, activeMenu])

  /** 异步通知可能晚于页面展示，在充值页轻量轮询订单列表 */
  useEffect(() => {
    if (!authToken || activeMenu !== 'recharge') return
    const tick = async () => {
      try {
        const r = await apiFetch('/api/pay/my-recharges', { headers: { Authorization: `Bearer ${authToken}` } })
        if (!r.ok) return
        const d = (await r.json()) as { items?: RechargeOrderRow[] }
        if (Array.isArray(d.items)) setRechargeOrders(d.items)
      } catch {
        /* ignore */
      }
    }
    const id = window.setInterval(tick, 10000)
    return () => window.clearInterval(id)
  }, [authToken, activeMenu])

  useEffect(() => {
    if (!authToken || activeMenu !== 'users' || normalizeAuthRole(authUser?.role) !== 'admin') return
    let cancelled = false
    setAdminUsersLoading(true)
    setAdminUsersError('')
    ;(async () => {
      try {
        const r = await apiFetch('/api/admin/users', { headers: { Authorization: `Bearer ${authToken}` } })
        const raw = await r.text()
        if (cancelled) return
        let d: { items?: AdminListUser[]; error?: string } = {}
        try {
          d = raw ? (JSON.parse(raw) as { items?: AdminListUser[]; error?: string }) : {}
        } catch {
          setAdminUsersError('列表解析失败')
          setAdminUsers([])
          return
        }
        if (!r.ok) {
          setAdminUsersError(d.error || `加载失败（${r.status}）`)
          setAdminUsers([])
          return
        }
        setAdminUsers(Array.isArray(d.items) ? d.items : [])
      } catch {
        if (!cancelled) {
          setAdminUsersError('网络异常')
          setAdminUsers([])
        }
      } finally {
        if (!cancelled) setAdminUsersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authToken, activeMenu, authUser])

  useEffect(() => {
    const update = () => {
      // 手机屏幕禁用画布（平板/电脑可用）
      setIsMobile(window.matchMedia('(max-width: 767px)').matches)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!authUser?.id) {
      setCanvasTrashByCanvasId({})
      return
    }
    try {
      const raw = window.localStorage.getItem(getCanvasTrashStorageKey(authUser.id))
      if (!raw) {
        setCanvasTrashByCanvasId({})
        return
      }
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setCanvasTrashByCanvasId(parsed as Record<string, CanvasImage[]>)
      } else {
        setCanvasTrashByCanvasId({})
      }
    } catch {
      setCanvasTrashByCanvasId({})
    }
  }, [authUser?.id])

  useEffect(() => {
    const loadFromDb = async () => {
      if (!authToken || !authUser?.id) return
      try {
        const headers = { Authorization: `Bearer ${authToken}` }
        const [canvasResp, configResp, meResp, recordsResp, systemResp] = await Promise.all([
          apiFetch('/api/canvases', { headers }),
          apiFetch('/api/settings/interfaces', { headers }),
          apiFetch('/api/auth/me', { headers }),
          apiFetch('/api/records', { headers }),
          apiFetch('/api/settings/system', { headers }),
        ])

        if (canvasResp.ok) {
          const canvasData = await canvasResp.json()
          if (Array.isArray(canvasData.items)) {
            const factoryId = getFactoryCanvasId(authUser.id)
            const withFactory = canvasData.items.some((c: CanvasItem) => c.id === factoryId)
              ? canvasData.items
              : [...canvasData.items, { id: factoryId, createdAt: new Date().toISOString(), images: [] as CanvasImage[] }]
            setCanvases(withFactory)
            const dreamList = withFactory.filter((c: CanvasItem) => !isFactoryCanvasId(c.id))
            if (dreamList.length > 0) {
              const currentDreamStillExists =
                selectedCanvasId &&
                dreamList.some((item: CanvasItem) => item.id === selectedCanvasId) &&
                !isFactoryCanvasId(selectedCanvasId)
              const lastCanvasId = window.localStorage.getItem(getLastCanvasStorageKey(authUser.id))
              const preferredCanvas = dreamList.find((item: CanvasItem) => item.id === lastCanvasId)
              if (preferredCanvas) {
                setSelectedCanvasId(preferredCanvas.id)
              } else if (currentDreamStillExists && selectedCanvasId) {
                setSelectedCanvasId(selectedCanvasId)
              } else {
                setSelectedCanvasId(dreamList[0].id)
              }
            } else {
              setSelectedCanvasId(null)
            }
          }
        }

        if (configResp.ok) {
          const configData = await configResp.json()
          if (Array.isArray(configData.items)) {
            setInterfaceConfigs(configData.items)
          }
        }
        if (meResp.status === 403) {
          const meText = await meResp.text()
          try {
            const meData = JSON.parse(meText) as { code?: string }
            if (meData.code === 'BANNED') {
              setAuthUser(null)
              setAuthToken('')
              window.localStorage.removeItem(AUTH_STORAGE_KEY)
              return
            }
          } catch {
            /* ignore */
          }
        } else if (meResp.ok) {
          const meData = await meResp.json()
          if (meData?.user && authUser) {
            const u = meData.user as Partial<AuthUser>
            saveUserProfile({
              ...authUser,
              role: u.role ?? authUser.role,
              avatarUrl: u.avatarUrl || authUser.avatarUrl,
              balanceCents: Number(u.balanceCents ?? 0),
              banned: u.banned,
            })
          }
        }
        if (recordsResp.ok) {
          const recordsData = await recordsResp.json()
          setGenerationRecords(Array.isArray(recordsData.items) ? recordsData.items : [])
        }
        if (systemResp.ok) {
          const systemData = await systemResp.json()
          if (systemData?.settings) {
            const s = systemData.settings
            setSystemSettings({
              siteTitle: s.siteTitle || '万米画布',
              payProvider: s.payProvider === 'epay' ? 'epay' : 'none',
              epaySubmitUrl: s.epaySubmitUrl || '',
              epayPid: s.epayPid || '',
              epayKey: '',
              epayKeySet: Boolean(s.epayKeySet),
              allowUserRegister: Boolean(s.allowUserRegister),
              registerMode: s.registerMode === 'email_verification' ? 'email_verification' : 'default',
              emailProvider: s.emailProvider === 'qq' ? 'qq' : 'custom',
              emailVerificationEnabled: Boolean(s.emailVerificationEnabled),
              smtpHost: s.smtpHost || '',
              smtpPort: s.smtpPort ? String(s.smtpPort) : '',
              smtpSecure: Boolean(s.smtpSecure),
              smtpUser: s.smtpUser || '',
              smtpPass: s.smtpPass || '',
              verifyFromEmail: s.verifyFromEmail || '',
              emailSubjectTemplate: s.emailSubjectTemplate || '【万米画布】邮箱验证码',
              emailHtmlTemplate:
                s.emailHtmlTemplate ||
                '<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>欢迎使用万米画布</h2><p>你的验证码是：<b>{{code}}</b></p><p>5分钟内有效，请勿泄露给他人。</p></div>',
              registerGiftYuan: ((Number(s.registerGiftCents || 0) / 100) as number).toFixed(2),
            })
            if (s.siteTitle) setAppSiteTitle(String(s.siteTitle))
          }
        }
      } catch {
        // ignore loading errors in UI bootstrap
      }
    }
    loadFromDb()
  }, [authToken, authUser?.id])

  useEffect(() => {
    if (!authUser || !selectedCanvasId || isFactoryCanvasId(selectedCanvasId)) return
    window.localStorage.setItem(getLastCanvasStorageKey(authUser.id), selectedCanvasId)
  }, [selectedCanvasId, authUser])

  useEffect(() => {
    if (selectedCanvasId) return
    const firstDream = canvases.find((c) => !isFactoryCanvasId(c.id))
    if (!firstDream) return
    setSelectedCanvasId(firstDream.id)
    if (authUser) {
      window.localStorage.setItem(getLastCanvasStorageKey(authUser.id), firstDream.id)
    }
  }, [canvases, selectedCanvasId, authUser])

  useEffect(() => {
    if (!authToken || canvases.length === 0) return
    const timer = window.setTimeout(async () => {
      setSavingCanvas(true)
      try {
        const responses = await Promise.all(
          canvases.map((canvas) =>
            apiFetch(`/api/canvases/${canvas.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify(canvas),
            }),
          ),
        )
        const failed = responses.find((resp) => !resp.ok)
        if (failed) {
          // keep silent UI but ensure sync state can be inspected
          console.warn('Canvas sync failed with status:', failed.status)
        }
      } finally {
        setSavingCanvas(false)
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [canvases, authToken])

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    const hasGenerating = canvases.some((c) => c.images.some((img) => img.status === 'generating'))
    if (!hasGenerating) return
    const timer = window.setInterval(() => setGeneratingTick((v) => v + 1), 900)
    return () => window.clearInterval(timer)
  }, [canvases])

  useEffect(() => {
    if (activeMenu !== 'imageFactory' || !authUser?.id) return
    const len = canvases.find((c) => c.id === getFactoryCanvasId(authUser.id))?.images.length ?? 0
    if (len === 0) return
    factoryChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [activeMenu, authUser?.id, canvases])

  useEffect(() => {
    if (!authUser) return
    if (normalizeAuthRole(authUser.role) !== 'admin' && (activeMenu === 'system' || activeMenu === 'users')) {
      setActiveMenu('dreamCanvas')
    }
  }, [authUser, activeMenu])

  const hashString = (value: string) => {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0
    }
    return hash
  }

  useEffect(() => {
    if (!showAvatarModal) return
    setAvatarPrompt('')
    setGeneratedAvatarUrl(null)
    setSelectedAvatarUrl(authUser?.avatarUrl || null)
    setAvatarRemaining(null)
    loadAvatarRepo()
  }, [showAvatarModal])

  const handleThemeToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setRipple({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, show: true })
    window.setTimeout(() => setRipple((prev) => ({ ...prev, show: false })), 550)
    setIsDark((prev) => !prev)
  }

  const persistAuth = (token: string, user: AuthUser) => {
    const normalized = normalizeAuthUser(user)
    setAuthToken(token)
    setAuthUser(normalized)
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user: normalized }))
  }

  const handleLogout = () => {
    setAuthUser(null)
    setAuthToken('')
    setCanvasTrashByCanvasId({})
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const saveUserProfile = (nextUser: AuthUser) => {
    if (!authToken) return
    const normalized = normalizeAuthUser(nextUser)
    setAuthUser(normalized)
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: authToken,
        user: normalized,
      }),
    )
  }

  const loadInterfaceConfigs = async () => {
    if (!authToken) return
    const response = await apiFetch('/api/settings/interfaces', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (!response.ok) return
    const data = await response.json()
    setInterfaceConfigs(Array.isArray(data.items) ? data.items : [])
  }

  const loadGenerationRecords = async () => {
    if (!authToken) return
    const response = await apiFetch('/api/records', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (!response.ok) return
    const data = await response.json()
    setGenerationRecords(Array.isArray(data.items) ? data.items : [])
  }

  const handleCreateInterfaceConfig = async () => {
    if (!authToken) return
    setSettingsError('')
    try {
      const response = await apiFetch('/api/settings/interfaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          baseUrl: interfaceBaseUrl.trim(),
          apiKey: interfaceApiKey.trim(),
          model: interfaceModel.trim(),
          unitCostYuan: Number(interfaceUnitCostYuan),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsError(data.error || '新增接口失败')
        return
      }
      setInterfaceBaseUrl('')
      setInterfaceApiKey('')
      setInterfaceModel('gpt-image-2')
      setInterfaceUnitCostYuan('0.07')
      await loadInterfaceConfigs()
    } catch {
      setSettingsError('网络异常，请稍后再试')
    }
  }

  const handleDeleteInterfaceConfig = async (id: number) => {
    if (!authToken) return
    await apiFetch(`/api/settings/interfaces/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    })
    await loadInterfaceConfigs()
  }

  const handleSaveSystemSettings = async () => {
    if (!authToken) return
    setSettingsError('')
    try {
      const response = await apiFetch('/api/settings/system', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          siteTitle: String(systemSettings.siteTitle ?? '').trim() || '万米画布',
          payProvider: systemSettings.payProvider,
          epaySubmitUrl: String(systemSettings.epaySubmitUrl ?? '').trim(),
          epayPid: String(systemSettings.epayPid ?? '').trim(),
          ...(String(systemSettings.epayKey ?? '').trim()
            ? { epayKey: String(systemSettings.epayKey).trim() }
            : {}),
          allowUserRegister: systemSettings.allowUserRegister,
          registerMode: systemSettings.registerMode,
          emailProvider: systemSettings.emailProvider,
          emailVerificationEnabled: systemSettings.emailVerificationEnabled,
          smtpHost: String(systemSettings.smtpHost ?? '').trim(),
          smtpPort: systemSettings.smtpPort ? Number(systemSettings.smtpPort) : null,
          smtpSecure: systemSettings.smtpSecure,
          smtpUser: String(systemSettings.smtpUser ?? '').trim(),
          smtpPass: String(systemSettings.smtpPass ?? '').trim(),
          verifyFromEmail: String(systemSettings.verifyFromEmail ?? '').trim(),
          emailSubjectTemplate: systemSettings.emailSubjectTemplate,
          emailHtmlTemplate: systemSettings.emailHtmlTemplate,
          registerGiftYuan: Number(systemSettings.registerGiftYuan || '0'),
        }),
      })
      const raw = await response.text()
      let data: { error?: string } = {}
      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string }
        } catch {
          setSettingsError(
            response.ok
              ? '服务器返回了非 JSON 响应，请检查网关或后端日志'
              : `请求失败（${response.status}）：${raw.slice(0, 200)}`,
          )
          return
        }
      }
      if (!response.ok) {
        setSettingsError(data.error || `保存系统设置失败（HTTP ${response.status}）`)
        return
      }
      setAppSiteTitle(String(systemSettings.siteTitle ?? '').trim() || '万米画布')
      setSystemSettings((prev) => ({
        ...prev,
        epayKey: '',
        epayKeySet: Boolean(String(prev.epayKey ?? '').trim()) || prev.epayKeySet,
      }))
    } catch {
      setSettingsError('网络异常，请稍后再试')
    }
  }

  const handleRechargePay = async () => {
    if (!authToken) return
    setRechargeError('')
    const y = Number(rechargeAmount)
    if (!Number.isFinite(y) || y < 0.01 || y > 50000) {
      setRechargeError('金额需在 0.01～50000 元之间')
      return
    }
    setRechargeSubmitting(true)
    try {
      const response = await apiFetch('/api/pay/create-recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ amountYuan: y, payType: 'alipay' }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRechargeError(data.error || '创建支付失败')
        return
      }
      const method = (data.method as string) || 'POST'
      const action = data.action as string
      const fields = (data.fields as Record<string, string | number>) || {}
      const form = document.createElement('form')
      form.method = method
      form.action = action
      form.style.display = 'none'
      Object.entries(fields).forEach(([k, v]) => {
        const inp = document.createElement('input')
        inp.type = 'hidden'
        inp.name = k
        inp.value = String(v)
        form.appendChild(inp)
      })
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
    } catch {
      setRechargeError('网络异常，请稍后再试')
    } finally {
      setRechargeSubmitting(false)
    }
  }

  const openAdminBalanceModal = (user: AdminListUser) => {
    setAdminUsersError('')
    setAdminBalanceYuan('')
    setAdminBalanceNote('')
    setUserMgmtModal({ mode: 'balance', user })
  }

  const submitAdminBalance = async () => {
    if (!authToken || !userMgmtModal || userMgmtModal.mode !== 'balance') return
    const y = Number(adminBalanceYuan)
    if (!Number.isFinite(y) || y === 0) {
      setAdminUsersError('请输入有效金额（元），可为负数表示扣减')
      return
    }
    const addCents = Math.round(y * 100)
    setAdminModalLoading(true)
    setAdminUsersError('')
    try {
      const r = await apiFetch(`/api/admin/users/${userMgmtModal.user.id}/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ addCents, note: adminBalanceNote.trim() || undefined }),
      })
      const raw = await r.text()
      const d = raw ? (JSON.parse(raw) as { error?: string }) : {}
      if (!r.ok) {
        setAdminUsersError(d.error || '调整失败')
        return
      }
      const uid = userMgmtModal.user.id
      const nextBal = (d as { balanceCents?: number }).balanceCents
      setUserMgmtModal(null)
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, balanceCents: Number(nextBal ?? u.balanceCents) } : u)),
      )
    } catch {
      setAdminUsersError('网络异常')
    } finally {
      setAdminModalLoading(false)
    }
  }

  const openAdminHistoryModal = async (user: AdminListUser) => {
    if (!authToken) return
    setAdminUsersError('')
    setUserMgmtModal({ mode: 'history', user })
    setAdminModalLoading(true)
    setAdminHistoryRows([])
    try {
      const r = await apiFetch(`/api/admin/users/${user.id}/balance-history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const raw = await r.text()
      const d = raw ? (JSON.parse(raw) as { items?: BalanceHistoryRow[] }) : {}
      if (r.ok && Array.isArray(d.items)) setAdminHistoryRows(d.items)
    } catch {
      setAdminHistoryRows([])
    } finally {
      setAdminModalLoading(false)
    }
  }

  const openAdminGenModal = async (user: AdminListUser) => {
    if (!authToken) return
    setAdminUsersError('')
    setUserMgmtModal({ mode: 'records', user })
    setAdminModalLoading(true)
    setAdminGenRows([])
    try {
      const r = await apiFetch(`/api/admin/users/${user.id}/generation-records`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const raw = await r.text()
      const d = raw
        ? (JSON.parse(raw) as {
            items?: Array<{
              id: number
              prompt: string
              model: string
              size: string
              status: string
              costCents: number
              errorMessage: string | null
              imageUrl: string | null
              createdAt: string
            }>
          })
        : {}
      if (r.ok && Array.isArray(d.items)) setAdminGenRows(d.items)
    } catch {
      setAdminGenRows([])
    } finally {
      setAdminModalLoading(false)
    }
  }

  const toggleUserBanned = async (user: AdminListUser, banned: boolean) => {
    if (!authToken) return
    setAdminUsersError('')
    try {
      const r = await apiFetch(`/api/admin/users/${user.id}/banned`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ banned }),
      })
      const raw = await r.text()
      const d = raw ? (JSON.parse(raw) as { error?: string }) : {}
      if (!r.ok) {
        setAdminUsersError(d.error || '操作失败')
        return
      }
      setAdminUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, banned } : u)))
    } catch {
      setAdminUsersError('网络异常')
    }
  }

  const resetUserPasswordAdmin = async (user: AdminListUser) => {
    if (!authToken) return
    if (!window.confirm(`确定将用户「${user.username}」的密码重置为 123456？`)) return
    setAdminUsersError('')
    try {
      const r = await apiFetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const raw = await r.text()
      const d = raw ? (JSON.parse(raw) as { error?: string }) : {}
      if (!r.ok) {
        setAdminUsersError(d.error || '重置失败')
        return
      }
      window.alert('已重置为密码：123456')
    } catch {
      setAdminUsersError('网络异常')
    }
  }

  const toQqEmail = (value: string) => {
    const v = value.trim()
    if (!v) return ''
    if (v.includes('@')) return v
    return `${v}@qq.com`
  }

  const applyQqPreset = () => {
    setSystemSettings((prev) => ({
      ...prev,
      emailProvider: 'qq',
      smtpHost: 'smtp.qq.com',
      smtpPort: '465',
      smtpSecure: true,
      verifyFromEmail: prev.verifyFromEmail || toQqEmail(prev.smtpUser),
      emailSubjectTemplate: prev.emailSubjectTemplate || '【万米画布】QQ邮箱验证码',
      emailHtmlTemplate:
        prev.emailHtmlTemplate ||
        '<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>万米画布</h2><p>你的验证码：<b>{{code}}</b></p><p>请在 5 分钟内完成验证。</p></div>',
    }))
  }

  const handleSendRegisterCode = async () => {
    const email = authRegisterEmail.trim()
    if (!email) {
      setAuthError('请先填写邮箱')
      return
    }
    setRegisterSendBusy(true)
    setAuthError('')
    try {
      const response = await apiFetch('/api/auth/register/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const raw = await response.text()
      let data: { error?: string } = {}
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {}
      } catch {
        setAuthError('服务器响应异常')
        return
      }
      if (!response.ok) {
        setAuthError(data.error || '发送失败')
        return
      }
      setRegisterSendCooldown(60)
    } catch {
      setAuthError('网络异常，请稍后重试')
    } finally {
      setRegisterSendBusy(false)
    }
  }

  const handleAuthSubmit = async () => {
    const username = authUsername.trim()
    const password = authPassword.trim()
    if (!username || !password) {
      setAuthError('用户名和密码不能为空')
      return
    }
    if (
      authMode === 'register' &&
      publicRegisterMode === 'email_verification' &&
      (!authRegisterEmail.trim() || !authRegisterCode.trim())
    ) {
      setAuthError('请填写邮箱与验证码')
      return
    }

    setAuthSubmitting(true)
    setAuthError('')
    try {
      const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body =
        authMode === 'register' && publicRegisterMode === 'email_verification'
          ? {
              username,
              password,
              email: authRegisterEmail.trim(),
              emailCode: authRegisterCode.trim(),
            }
          : { username, password }
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await response.text()
      let data: { error?: string; code?: string; token?: string; user?: AuthUser } = {}
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {}
      } catch {
        setAuthError('服务器响应异常')
        return
      }
      if (!response.ok) {
        setAuthError(data.error || '认证失败')
        return
      }
      if (!data.token || !data.user) {
        setAuthError('登录数据不完整')
        return
      }
      persistAuth(data.token, data.user)
      setAuthPassword('')
      setAuthUsername('')
      setAuthRegisterEmail('')
      setAuthRegisterCode('')
    } catch {
      setAuthError('网络异常，请稍后重试')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleGenerateAvatar = async () => {
    const prompt = avatarPrompt.trim()
    if (!prompt || avatarGenerating) return
    setAvatarGenerating(true)
    try {
      const response = await apiFetch('/api/avatars/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ prompt }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAuthError(data.error || '头像生成失败')
        return
      }
      setGeneratedAvatarUrl(data.imageUrl)
      setSelectedAvatarUrl(data.imageUrl)
      if (typeof data.remaining === 'number') setAvatarRemaining(data.remaining)
      await loadAvatarRepo()
    } catch (error) {
      setGeneratedAvatarUrl(null)
      setAuthError(error instanceof Error ? error.message : '头像生成失败')
    } finally {
      setAvatarGenerating(false)
    }
  }

  const handleApplyAvatar = () => {
    if (!authUser || !selectedAvatarUrl) return
    apiFetch('/api/auth/avatar', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ avatarUrl: selectedAvatarUrl }),
    }).then(async (resp) => {
      if (!resp.ok) return
      saveUserProfile({ ...authUser, avatarUrl: selectedAvatarUrl })
      setShowAvatarModal(false)
      setAvatarPrompt('')
      setGeneratedAvatarUrl(null)
      setSelectedAvatarUrl(null)
    })
  }

  const loadAvatarRepo = async () => {
    if (!authToken) return
    const response = await apiFetch('/api/avatars', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (!response.ok) return
    const data = await response.json()
    setAvatarRepo(Array.isArray(data.items) ? data.items : [])
  }

  const handleCreateCanvas = () => {
    const item: CanvasItem = { id: `${Date.now()}`, createdAt: new Date().toISOString(), images: [] }
    setCanvases((prev) => [item, ...prev])
    setSelectedCanvasId(item.id)
    setShowCanvasSelector(false)
    setSelectedImageId(null)
    setViewport({ x: 0, y: 0, scale: 1 })
  }

  const dreamCanvas = canvases.find((item) => item.id === selectedCanvasId) ?? null
  const factoryCanvasId = authUser?.id ? getFactoryCanvasId(authUser.id) : null
  const factoryCanvas = factoryCanvasId ? (canvases.find((c) => c.id === factoryCanvasId) ?? null) : null
  const selectedCanvas = dreamCanvas
  const imageContextCanvas = activeMenu === 'imageFactory' ? factoryCanvas : dreamCanvas
  const selectedImage = imageContextCanvas?.images.find((img) => img.id === selectedImageId) ?? null
  const trashCanvasId =
    activeMenu === 'imageFactory' && factoryCanvasId ? factoryCanvasId : selectedCanvasId

  const createImageDraft = (
    prompt: string,
    size: string,
    position?: { x: number; y: number },
    sourceImageId?: string,
    targetCanvasId: string | null = selectedCanvasId,
  ) => {
    if (!targetCanvasId) return null
    const container = canvasViewportRef.current
    const containerWidth = container?.clientWidth ?? 1000
    const containerHeight = container?.clientHeight ?? 700
    const worldX = position ? position.x : (containerWidth / 2 - viewport.x) / viewport.scale
    const worldY = position ? position.y : (containerHeight / 2 - viewport.y) / viewport.scale
    const id = `${Date.now()}-${Math.random()}`

    const draft: CanvasImage = {
      id,
      prompt,
      size,
      x: worldX,
      y: worldY,
      sourceImageId,
      status: 'generating',
      imageUrl: null,
      error: null,
      startedAt: performance.now(),
    }

    setCanvases((prev) =>
      prev.map((canvas) => (canvas.id === targetCanvasId ? { ...canvas, images: [...canvas.images, draft] } : canvas)),
    )
    setSelectedImageId(id)
    return id
  }

  const updateImage = (imageId: string, patch: Partial<CanvasImage>, targetCanvasId: string | null = selectedCanvasId) => {
    if (!targetCanvasId) return
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === targetCanvasId
          ? { ...canvas, images: canvas.images.map((img) => (img.id === imageId ? { ...img, ...patch } : img)) }
          : canvas,
      ),
    )
  }

  const persistCanvasTrashToStorage = (next: Record<string, CanvasImage[]>) => {
    if (!authUser?.id) return
    try {
      window.localStorage.setItem(getCanvasTrashStorageKey(authUser.id), JSON.stringify(next))
    } catch {
      // ignore quota / private mode
    }
  }

  const restoreFromTrash = (imageId: string) => {
    if (!trashCanvasId) return
    const list = canvasTrashByCanvasId[trashCanvasId] || []
    const snapshot = list.find((img) => img.id === imageId)
    if (!snapshot) return
    const live = canvases.find((c) => c.id === trashCanvasId)
    if (live?.images.some((img) => img.id === snapshot.id)) return

    const restored: CanvasImage = { ...snapshot }
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === trashCanvasId ? { ...canvas, images: [...canvas.images, restored] } : canvas,
      ),
    )
    setCanvasTrashByCanvasId((prev) => {
      const nextList = (prev[trashCanvasId] || []).filter((img) => img.id !== imageId)
      const next = { ...prev, [trashCanvasId]: nextList }
      persistCanvasTrashToStorage(next)
      return next
    })
  }

  const clearCurrentCanvasTrash = () => {
    if (!trashCanvasId) return
    setCanvasTrashByCanvasId((prev) => {
      const next = { ...prev, [trashCanvasId]: [] }
      persistCanvasTrashToStorage(next)
      return next
    })
  }

  const deleteImage = (imageId: string, overrideCanvasId?: string | null) => {
    const canvasId = overrideCanvasId ?? selectedCanvasId
    if (!canvasId) return
    const canvas = canvases.find((c) => c.id === canvasId)
    const deleted = canvas?.images.find((img) => img.id === imageId)
    if (!deleted) return
    const snapshot: CanvasImage = { ...deleted }

    setCanvasTrashByCanvasId((prev) => {
      const next = {
        ...prev,
        [canvasId]: [snapshot, ...(prev[canvasId] || [])],
      }
      persistCanvasTrashToStorage(next)
      return next
    })

    setCanvases((prev) =>
      prev.map((canvas) => {
        if (canvas.id !== canvasId) return canvas

        const remaining = canvas.images.filter((img) => img.id !== imageId)
        // 删除的是「修改链」上的图（右侧衍生图）：主列上方并没有腾出空位，不应触发主列整体上移，
        // 否则会和后续再次修改时的横向占位重叠。
        if (deleted.sourceImageId) {
          return { ...canvas, images: remaining }
        }

        const primary = remaining.filter((img) => !img.sourceImageId).sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
        if (primary.length === 0) {
          return { ...canvas, images: remaining }
        }

        const topY = 80
        const verticalGap = 24
        const primaryNextYMap = new Map<string, number>()
        let cursorY = topY
        for (const item of primary) {
          primaryNextYMap.set(item.id, cursorY)
          cursorY += getCardHeight(item.size) + verticalGap
        }

        const byId = new Map(remaining.map((img) => [img.id, img]))
        const shiftCache = new Map<string, number>()
        const getShift = (img: CanvasImage): number => {
          if (shiftCache.has(img.id)) return shiftCache.get(img.id) || 0
          let shift = 0
          if (!img.sourceImageId) {
            const nextY = primaryNextYMap.get(img.id)
            if (typeof nextY === 'number') shift = nextY - img.y
          } else {
            const source = byId.get(img.sourceImageId)
            if (source) shift = getShift(source)
          }
          shiftCache.set(img.id, shift)
          return shift
        }

        const compacted = remaining.map((img) => {
          const shift = getShift(img)
          return shift === 0 ? img : { ...img, y: img.y + shift }
        })

        return { ...canvas, images: compacted }
      }),
    )
    setSelectedImageId(null)
  }

  const getNextAlignedPositionOnCanvas = (canvas: CanvasItem | null) => {
    const images = canvas?.images ?? []
    if (images.length === 0) return { x: 80, y: 80 }

    const primaryImages = images.filter((item) => !item.sourceImageId)
    const verticalGap = 24

    if (primaryImages.length === 0) {
      const fallbackFirst = images[0] || { x: 80, y: 80, size: '1024x1024' }
      return {
        x: fallbackFirst.x,
        y: fallbackFirst.y + getCardHeight(fallbackFirst.size) + verticalGap,
      }
    }

    const anchorX = primaryImages[0].x
    const maxBottom = images.reduce((acc, item) => {
      const bottom = item.y + getCardHeight(item.size)
      return Math.max(acc, bottom)
    }, primaryImages[0].y)
    return { x: anchorX, y: maxBottom + verticalGap }
  }

  const getNextAlignedPosition = () => getNextAlignedPositionOnCanvas(dreamCanvas)

  const getModifyPositionOnCanvas = (canvas: CanvasItem | null, sourceId: string) => {
    const source = canvas?.images.find((item) => item.id === sourceId)
    if (!source) return getNextAlignedPositionOnCanvas(canvas)
    const siblings = (canvas?.images || []).filter((item) => item.sourceImageId === sourceId)
    if (siblings.length === 0) return { x: source.x + 324, y: source.y }
    const rightMost = siblings.reduce((acc, item) => (item.x > acc.x ? item : acc), siblings[0])
    return { x: rightMost.x + 324, y: source.y }
  }

  const getImageAspectRatio = (size: string) => {
    const match = /^(\d+)x(\d+)$/.exec(size)
    if (!match) return 1
    const width = Number(match[1])
    const height = Number(match[2])
    if (!width || !height) return 1
    return width / height
  }

  const pickClosestSizeByRatio = (ratio: number) => {
    const candidates = ['1024x1024', '1080x1920', '1920x1080', '1024x1792'] as const
    let best: string = candidates[0]
    let bestDelta = Number.POSITIVE_INFINITY
    for (const size of candidates) {
      const candidateRatio = getImageAspectRatio(size)
      const delta = Math.abs(candidateRatio - ratio)
      if (delta < bestDelta) {
        bestDelta = delta
        best = size
      }
    }
    return best
  }

  const getImageNaturalRatio = (url: string) =>
    new Promise<number>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const w = (img as HTMLImageElement).naturalWidth || 1
        const h = (img as HTMLImageElement).naturalHeight || 1
        resolve(w / h)
      }
      img.onerror = () => resolve(1)
      img.src = url
    })

  const getPreviewHeight = (size: string) => 288 / getImageAspectRatio(size)

  const getCardHeight = (size: string) => Math.max(260, getPreviewHeight(size) + 64)

  const pollImageTaskUntilDone = async (taskId: string) => {
    const maxAttempts = 40
    const intervalMs = 2500

    for (let i = 0; i < maxAttempts; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
      const response = await apiFetch(`/api/images/task/${taskId}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      })
      const rawText = await response.text()
      let data: Record<string, unknown> = {}

      if (rawText) {
        try {
          data = JSON.parse(rawText) as Record<string, unknown>
        } catch {
          data = { raw: rawText }
        }
      }

      if (!response.ok) {
        throw new Error(
          JSON.stringify(
            {
              status: response.status,
              statusText: response.statusText,
              data,
            },
            null,
            2,
          ),
        )
      }

      if (data.status === 'completed' && data.imageUrl) {
        return data as {
          imageUrl: string
          sourceImageUrl?: string
          balanceCents?: number
          status: string
          taskId?: string
          progress?: number
        }
      }

      if (data.status === 'failed') {
        throw new Error(JSON.stringify(data, null, 2))
      }
    }

    throw new Error(
      JSON.stringify(
        {
          status: 'timeout',
          error: '轮询超时，请稍后重试',
        },
        null,
        2,
      ),
    )
  }

  const generateImageRequest = async (prompt: string, size: string, model: string, urls: string[]) => {
    const response = await apiFetch('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ prompt, size, model, urls }),
    })
    const rawText = await response.text()
    let data: Record<string, unknown> = {}

    if (rawText) {
      try {
        data = JSON.parse(rawText) as Record<string, unknown>
      } catch {
        data = { raw: rawText }
      }
    } else {
      data = { error: 'empty_response_body' }
    }

    if (!response.ok) {
      throw new Error(
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            data,
          },
          null,
          2,
        ),
      )
    }

    if (data.status === 'completed' && data.imageUrl) {
      return data as {
        imageUrl: string
        sourceImageUrl?: string
        balanceCents?: number
        status: string
        taskId?: string
        progress?: number
      }
    }

    const taskId =
      (typeof data.taskId === 'string' && data.taskId) ||
      (typeof data.task_id === 'string' && data.task_id) ||
      (typeof data.id === 'string' && data.id)

    if ((data.status === 'queued' || data.status === 'in_progress') && taskId) {
      return await pollImageTaskUntilDone(taskId)
    }

    throw new Error(JSON.stringify(data, null, 2))
  }

  const handleGenerate = async () => {
    const prompt = promptText.trim()
    if (!prompt || isSubmitting) return
    const isFactory = activeMenu === 'imageFactory'
    const targetCanvasId =
      isFactory && authUser?.id ? getFactoryCanvasId(authUser.id) : selectedCanvasId
    if (!targetCanvasId) return
    const genCanvas = isFactory ? factoryCanvas : dreamCanvas
    const urls = referenceImages
    let targetImageId: string | null = null

    setIsSubmitting(true)
    try {
      if (isModifyMode && selectedImage) {
        const sourceImageUrl = selectedImage.imageUrl ? [selectedImage.imageUrl] : []
        const mergedUrls = [...sourceImageUrl, ...urls].slice(0, 1)
        const draftId = createImageDraft(
          prompt,
          imageSize,
          getModifyPositionOnCanvas(genCanvas, selectedImage.id),
          selectedImage.id,
          targetCanvasId,
        )
        if (!draftId) return
        targetImageId = draftId
        const result = await generateImageRequest(prompt, imageSize, imageModel, mergedUrls)
        updateImage(
          draftId,
          {
            status: 'completed',
            imageUrl: result.imageUrl,
            startedAt: null,
            uploadedToGallery: false,
          },
          targetCanvasId,
        )
        if (result.imageUrl) uploadGeneratedToPublicInBackground(draftId, result.imageUrl, targetCanvasId)
        if (typeof result.balanceCents === 'number' && authUser) {
          saveUserProfile({ ...authUser, balanceCents: result.balanceCents })
        }
      } else {
        const draftId = createImageDraft(
          prompt,
          imageSize,
          getNextAlignedPositionOnCanvas(genCanvas),
          undefined,
          targetCanvasId,
        )
        if (!draftId) return
        targetImageId = draftId
        const result = await generateImageRequest(prompt, imageSize, imageModel, urls.slice(0, 1))
        updateImage(
          draftId,
          {
            status: 'completed',
            imageUrl: result.imageUrl,
            startedAt: null,
            uploadedToGallery: false,
          },
          targetCanvasId,
        )
        if (result.imageUrl) uploadGeneratedToPublicInBackground(draftId, result.imageUrl, targetCanvasId)
        if (typeof result.balanceCents === 'number' && authUser) {
          saveUserProfile({ ...authUser, balanceCents: result.balanceCents })
        }
      }
      setPromptText('')
      setIsModifyMode(false)
      setModifySourceImageId(null)
      setReferenceImages([])
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败'
      if (targetImageId) {
        updateImage(
          targetImageId,
          {
            status: 'failed',
            error: message,
            startedAt: null,
          },
          targetCanvasId,
        )
      }
    } finally {
      setIsSubmitting(false)
      await loadGenerationRecords()
    }
  }

  const startModifyFromImage = (img: CanvasImage) => {
    setSelectedImageId(img.id)
    setPromptText('')
    setReferenceImages(img.imageUrl ? [img.imageUrl] : [])
    setIsModifyMode(true)
    setModifySourceImageId(img.id)
    if (activeMenu !== 'imageFactory') {
      setShowPromptWindow(true)
    }
  }

  const handleStartModify = () => {
    if (!selectedImage) return
    startModifyFromImage(selectedImage)
  }

  const handleCopyLink = async (imageUrl: string | null) => {
    if (!imageUrl) return
    await navigator.clipboard.writeText(imageUrl)
  }

  const handleDownloadImage = async (imageUrl: string | null) => {
    if (!imageUrl) return
    const baseName = `wanmihuabu-${Date.now()}`

    const triggerBlobDownload = (blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${baseName}.png`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2500)
    }

    const fetchAsBlob = async (credentials: RequestCredentials) => {
      const res = await apiFetch(imageUrl, {
        mode: 'cors',
        credentials,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      if (!blob.size) throw new Error('empty')
      return blob
    }

    try {
      triggerBlobDownload(await fetchAsBlob('omit'))
      return
    } catch {
      /* retry same-origin with cookies */
    }

    try {
      if (new URL(imageUrl, window.location.href).origin === window.location.origin) {
        triggerBlobDownload(await fetchAsBlob('include'))
        return
      }
    } catch {
      /* ignore */
    }

    try {
      if (!authToken) throw new Error('no auth')
      const proxy = `/api/images/download-proxy?url=${encodeURIComponent(imageUrl)}`
      const res = await apiFetch(proxy, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      if (!blob.size) throw new Error('empty')
      triggerBlobDownload(blob)
      return
    } catch {
      /* ignore */
    }

    console.warn('无法直接下载，请使用「复制链接」或长按图片保存:', imageUrl)
  }

  const handlePasteAlbumText = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setAlbumInput(text)
    } catch {
      setAlbumParseError('读取剪贴板失败，请手动粘贴')
    }
  }

  const handleUploadReferenceFile = async (file: File | null) => {
    if (!file || referenceUploading) return
    setReferenceUploading(true)
    setReferenceUploadError('')
    try {
      const form = new FormData()
      form.append('image', file)
      const response = await apiFetch('/api/images/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      })
      const data = await response.json()
      if (!response.ok) {
        setReferenceUploadError(data.error || '上传参考图失败')
        return
      }
      if (data.imageUrl) {
        // 只允许 1 张参考图：上传即替换
        setReferenceImages([String(data.imageUrl)])
      }
    } catch {
      setReferenceUploadError('上传参考图失败，请稍后重试')
    } finally {
      setReferenceUploading(false)
    }
  }

  const handleRemoveReferenceImage = (url: string) => {
    setReferenceImages((prev) => prev.filter((item) => item !== url))
  }

  const uploadGeneratedToPublicInBackground = (
    imageId: string,
    sourceUrl: string,
    targetCanvasId: string | null = selectedCanvasId,
  ) => {
    window.setTimeout(async () => {
      try {
        const response = await apiFetch('/api/images/import-from-urls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ urls: [sourceUrl] }),
        })
        if (!response.ok) return
        const data = await response.json()
        const publicUrl = Array.isArray(data.items) ? data.items[0]?.imageUrl : null
        if (publicUrl) {
          updateImage(imageId, { imageUrl: publicUrl, uploadedToGallery: true }, targetCanvasId)
        }
      } catch {
        // ignore
      }
    }, 3000)
  }

  const handleParseAlbum = async () => {
    const requestURL = albumInput.trim()
    if (!requestURL || albumParsing) return
    setAlbumParsing(true)
    setAlbumParseError('')
    setAlbumCandidates([])
    setSelectedAlbumUrls([])
    try {
      const response = await apiFetch('/api/images/parse-album', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          requestURL,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAlbumParseError(data.error || '图集解析失败')
        return
      }
      const urls = Array.isArray(data.imageUrls) ? data.imageUrls : []
      if (urls.length === 0) {
        setAlbumParseError(data.hint || '未解析出图片链接')
        return
      }
      setAlbumCandidates(urls)
    } catch {
      setAlbumParseError('图集解析失败，请稍后重试')
    } finally {
      setAlbumParsing(false)
    }
  }

  const toggleAlbumSelect = (url: string) => {
    setSelectedAlbumUrls((prev) => (prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]))
  }

  const handleInsertParsedImages = async () => {
    if (!selectedCanvasId || selectedAlbumUrls.length === 0 || albumImporting) return
    setAlbumImporting(true)
    setAlbumParseError('')
    try {
      const response = await apiFetch('/api/images/import-from-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ urls: selectedAlbumUrls }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAlbumParseError(data.error || '上传到公共图库失败')
        return
      }
      const items = Array.isArray(data.items) ? data.items : []
      for (const item of items) {
        const ratio = await getImageNaturalRatio(item.imageUrl)
        const closestSize = pickClosestSizeByRatio(ratio)
        const pos = getNextAlignedPosition()
        const draftId = createImageDraft('图集导入', closestSize, pos)
        if (!draftId) continue
        updateImage(draftId, {
          status: 'completed',
          imageUrl: item.imageUrl,
          startedAt: null,
          uploadedToGallery: true,
        })
      }
      setShowAlbumParserModal(false)
      setAlbumInput('')
      setAlbumCandidates([])
      setSelectedAlbumUrls([])
    } catch {
      setAlbumParseError('导入失败，请稍后重试')
    } finally {
      setAlbumImporting(false)
    }
  }

  const openUserMenu = () => {
    if (userMenuCloseTimerRef.current) {
      window.clearTimeout(userMenuCloseTimerRef.current)
      userMenuCloseTimerRef.current = null
    }
    setShowUserMenu(true)
  }

  const scheduleCloseUserMenu = () => {
    if (userMenuCloseTimerRef.current) {
      window.clearTimeout(userMenuCloseTimerRef.current)
    }
    userMenuCloseTimerRef.current = window.setTimeout(() => {
      setShowUserMenu(false)
    }, 180)
  }

  const getCanvasTitle = (canvas: CanvasItem, fallbackIndex: number) => {
    const firstPrompt = canvas.images?.[0]?.prompt?.trim()
    if (!firstPrompt) return `画布 ${fallbackIndex}`
    return firstPrompt.length > 14 ? `${firstPrompt.slice(0, 14)}...` : firstPrompt
  }

  const filteredCanvases = canvases.filter((canvas, index) => {
    if (isFactoryCanvasId(canvas.id)) return false
    const keyword = canvasSearch.trim().toLowerCase()
    if (!keyword) return true
    const title = getCanvasTitle(canvas, canvases.length - index).toLowerCase()
    return title.includes(keyword)
  })

  const modelOptions = Array.from(
    new Set(['gpt-image-2', ...interfaceConfigs.map((item) => item.model).filter(Boolean)]),
  )

  const unitCostCentsForModel = (model: string) => {
    const cfg = interfaceConfigs.find((item) => item.model === model)
    return Number(cfg?.unitCostCents ?? 7)
  }

  const formatGenerateCostHint = () => {
    const costYuan = (unitCostCentsForModel(imageModel) / 100).toFixed(2)
    return { costYuan }
  }

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    setIsPanning(true)
    setPanStart({ x: event.clientX, y: event.clientY, originX: viewport.x, originY: viewport.y })
    setSelectedImageId(null)
  }

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPanning) return
    const deltaX = event.clientX - panStart.x
    const deltaY = event.clientY - panStart.y
    setViewport((prev) => ({ ...prev, x: panStart.originX + deltaX, y: panStart.originY + deltaY }))
  }
  const stopPanning = () => setIsPanning(false)

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const container = canvasViewportRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08

    setViewport((prev) => {
      const nextScale = Math.min(2.5, Math.max(0.4, prev.scale * zoomFactor))
      const worldX = (pointerX - prev.x) / prev.scale
      const worldY = (pointerY - prev.y) / prev.scale
      return { x: pointerX - worldX * nextScale, y: pointerY - worldY * nextScale, scale: nextScale }
    })
  }

  if (!authUser) {
  return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{appSiteTitle}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {authMode === 'login' ? '登录后进入控制台' : '注册后进入控制台'}
          </p>
          <div className="mt-5 space-y-3">
            <input
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
              placeholder="用户名"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="密码（至少6位）"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
            />
            {authMode === 'register' && publicRegisterMode === 'email_verification' && (
              <>
                <input
                  type="email"
                  autoComplete="email"
                  value={authRegisterEmail}
                  onChange={(event) => setAuthRegisterEmail(event.target.value)}
                  placeholder="邮箱（用于接收验证码）"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <input
                    value={authRegisterCode}
                    onChange={(event) => setAuthRegisterCode(event.target.value)}
                    placeholder="邮箱验证码"
                    className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={handleSendRegisterCode}
                    disabled={registerSendBusy || registerSendCooldown > 0}
                    className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {registerSendCooldown > 0 ? `${registerSendCooldown}s` : registerSendBusy ? '发送中…' : '发送验证码'}
                  </button>
                </div>
              </>
            )}
            {authError && <div className="text-sm text-red-500">{authError}</div>}
            <button
              onClick={handleAuthSubmit}
              disabled={authSubmitting}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {authSubmitting ? '提交中...' : authMode === 'login' ? '登录' : '注册'}
            </button>
            {publicAllowRegister && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))
                  setAuthError('')
                  setAuthRegisterCode('')
                }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {authMode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isAdminUser = normalizeAuthRole(authUser.role) === 'admin'

  return (
    <div className={`${isDark ? 'dark' : ''} overflow-x-hidden`}>
      <div className="relative flex min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {ripple.show && (
          <span className="pointer-events-none fixed h-8 w-8 animate-ripple rounded-full bg-black/20 dark:bg-white/20" style={{ left: ripple.x, top: ripple.y }} />
        )}
        {!isMobile && (
          <aside
            className={`border-r border-slate-200 bg-white p-5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}
          >
            <div className="text-lg font-semibold">
              {sidebarCollapsed ? appSiteTitle.slice(0, 2) : appSiteTitle}
            </div>
            <nav className="mt-8 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => setActiveMenu('dreamCanvas')}
                className={`w-full rounded-lg px-3 py-2 text-left ${activeMenu === 'dreamCanvas' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'}`}
                title="造梦画布"
              >
                {sidebarCollapsed ? '梦' : '造梦画布'}
              </button>
              <button
                type="button"
                onClick={() => setActiveMenu('imageFactory')}
                className={`w-full rounded-lg px-3 py-2 text-left ${activeMenu === 'imageFactory' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'}`}
                title="图片工厂"
              >
                {sidebarCollapsed ? '厂' : '图片工厂'}
              </button>
              <button
                type="button"
                onClick={() => setActiveMenu('records')}
                className={`w-full rounded-lg px-3 py-2 text-left ${activeMenu === 'records' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'}`}
              >
                {sidebarCollapsed ? '记' : '生成记录'}
              </button>
              <button
                type="button"
                onClick={() => setActiveMenu('recharge')}
                className={`w-full rounded-lg px-3 py-2 text-left ${activeMenu === 'recharge' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'}`}
                title="余额充值"
              >
                {sidebarCollapsed ? '充' : '余额充值'}
              </button>
              {isAdminUser && (
                <>
                  <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu('system')
                      setSystemSubMenu('interface')
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left ${activeMenu === 'system' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'}`}
                  >
                    {sidebarCollapsed ? '配' : '系统配置'}
                  </button>
                  {!sidebarCollapsed && activeMenu === 'system' && (
                    <div className="ml-3 space-y-1">
                      <button
                        type="button"
                        onClick={() => setSystemSubMenu('interface')}
                        className={`w-[calc(100%-12px)] rounded-lg px-3 py-2 text-left text-xs ${
                          systemSubMenu === 'interface'
                            ? 'bg-slate-100 dark:bg-slate-800'
                            : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        接口配置
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSystemSubMenu('system')
                          setSystemSettingsTab('general')
                        }}
                        className={`w-[calc(100%-12px)] rounded-lg px-3 py-2 text-left text-xs ${
                          systemSubMenu === 'system'
                            ? 'bg-slate-100 dark:bg-slate-800'
                            : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        系统设置
                      </button>
        </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveMenu('users')}
                    className={`w-full rounded-lg px-3 py-2 text-left ${activeMenu === 'users' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'}`}
                    title="用户管理"
                  >
                    {sidebarCollapsed ? '管' : '用户管理'}
                  </button>
                </>
              )}
            </nav>
          </aside>
        )}

        {isMobile && mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <aside className="flex h-full w-[min(17rem,85vw)] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="text-base font-semibold">{appSiteTitle}</div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
        </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3 text-sm text-slate-600 dark:text-slate-300">
        <button
          type="button"
                  onClick={() => {
                    setActiveMenu('dreamCanvas')
                    setMobileSidebarOpen(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left ${activeMenu === 'dreamCanvas' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                >
                  造梦画布
        </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('imageFactory')
                    setMobileSidebarOpen(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left ${activeMenu === 'imageFactory' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                >
                  图片工厂
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('records')
                    setMobileSidebarOpen(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left ${activeMenu === 'records' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                >
                  生成记录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('recharge')
                    setMobileSidebarOpen(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left ${activeMenu === 'recharge' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                >
                  余额充值
                </button>
                {isAdminUser && (
                  <>
                    <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu('system')
                        setSystemSubMenu('interface')
                        setMobileSidebarOpen(false)
                      }}
                      className={`w-full rounded-lg px-3 py-2.5 text-left ${activeMenu === 'system' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                    >
                      系统配置
                    </button>
                    {activeMenu === 'system' && (
                      <div className="ml-2 space-y-1 border-l border-slate-200 pl-2 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setSystemSubMenu('interface')}
                          className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                            systemSubMenu === 'interface' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          接口配置
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSystemSubMenu('system')
                            setSystemSettingsTab('general')
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                            systemSubMenu === 'system' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          系统设置
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu('users')
                        setMobileSidebarOpen(false)
                      }}
                      className={`w-full rounded-lg px-3 py-2.5 text-left ${activeMenu === 'users' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                    >
                      用户管理
                    </button>
                  </>
                )}
              </nav>
            </aside>
            <button
              type="button"
              aria-label="关闭菜单"
              className="min-w-0 flex-1 cursor-default bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
          </div>
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-md border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="展开侧边栏"
                >
                  <Menu size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  className="rounded-md border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
                >
                  {sidebarCollapsed ? <PanelRight size={18} /> : <PanelLeft size={18} />}
                </button>
              )}
              <div className="h-5 w-1" />
        </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
              <button onClick={handleThemeToggle} className="rounded-md border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="切换主题">{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
              <div className="whitespace-nowrap rounded-md border border-slate-200 px-2 py-1.5 text-[10px] text-slate-700 dark:border-slate-700 dark:text-slate-200 sm:px-3 sm:text-xs">
                <span className="hidden sm:inline">余额 </span>¥{((authUser.balanceCents || 0) / 100).toFixed(2)}
              </div>
              <div
                ref={userMenuRef}
                className="relative min-w-0 pb-2 pl-1"
                onMouseEnter={openUserMenu}
                onMouseLeave={scheduleCloseUserMenu}
              >
                <button
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="flex max-w-[min(10rem,42vw)] items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-700 sm:max-w-none sm:gap-2"
                >
                  {authUser.avatarUrl ? (
                    <img
                      src={authUser.avatarUrl}
                      alt="头像"
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="h-7 w-7 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                  <span className="truncate text-sm">{authUser.username}</span>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-32 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <button
                      onClick={() => {
                        setShowAvatarModal(true)
                        setShowUserMenu(false)
                      }}
                      className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      修改头像
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      退出登录
                    </button>
        </div>
                )}
              </div>
            </div>
          </header>

          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden p-2">
            {showCanvasSelector && (
                  <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-semibold">选择画布</h3>
                        <div className="flex items-center gap-2">
        <button
                            onClick={() => setShowCanvasSelector(false)}
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
                            关闭
        </button>
                          <button
                            onClick={handleCreateCanvas}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
                          >
                            <Plus size={14} />
                            创建新画布
                          </button>
                        </div>
                      </div>
                      <input
                        value={canvasSearch}
                        onChange={(event) => setCanvasSearch(event.target.value)}
                        placeholder="搜索画布关键词..."
                        className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                      />
                      {canvases.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          暂无历史画布，请点击右上角创建新画布。
                        </div>
                      ) : filteredCanvases.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          没有匹配到画布，请换个关键词试试。
                        </div>
                      ) : (
                        <div className="max-h-[30rem] overflow-auto">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredCanvases.map((item, index) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setSelectedCanvasId(item.id)
                                  setShowCanvasSelector(false)
                                  if (authUser) {
                                    window.localStorage.setItem(getLastCanvasStorageKey(authUser.id), item.id)
                                  }
                                }}
                                className="overflow-hidden rounded-xl border border-slate-200 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:hover:bg-slate-800/40"
                              >
                                <div className="h-40 bg-slate-100 dark:bg-slate-800">
                                  {item.images?.[0]?.imageUrl ? (
                                    <img
                                      src={item.images[0].imageUrl}
                                      alt="画布首图预览"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                      暂无预览图
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1 p-3">
                                  <div className="line-clamp-1 text-sm font-semibold">
                                    {getCanvasTitle(item, canvases.length - index)}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(item.createdAt).toLocaleString()}
                                  </div>
                                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                    图片 {item.images?.length || 0} 张
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

            {activeMenu === 'dreamCanvas' && (
              <div className="relative h-full">
                {isMobile ? (
                  <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900">
                    <div className="max-w-md">
                      <div className="text-base font-semibold">造梦画布需较大屏幕</div>
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        拖拽与缩放画布在手机上过小不便操作，请用平板或电脑使用造梦画布。
                      </div>
                      <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                        手机端请点击左上角菜单打开侧栏，进入「图片工厂」生成（与造梦画布相同扣费逻辑）；生成结果在「造梦画布」中查看。
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                {selectedCanvas && (
                  <div className="h-full rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
                    <div
                      ref={canvasViewportRef}
                      onPointerDown={handleCanvasPointerDown}
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={stopPanning}
                      onPointerLeave={stopPanning}
                      onWheel={handleCanvasWheel}
                      className={`relative h-[calc(100vh-120px)] min-h-[740px] overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{
                        backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
                        backgroundSize: `${40 * viewport.scale}px ${40 * viewport.scale}px`,
                        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                      }}
                    >
                      <div
                        className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <button
                          onClick={() => setShowPromptWindow((prev) => !prev)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          {showPromptWindow ? '关闭生成窗口' : '打开生成窗口'}
                        </button>
                        <button
                          onClick={() => setShowAlbumParserModal(true)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          图集解析
                        </button>
                        <button
                          onClick={() => setShowCanvasSelector(true)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          切换画布
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTrashModal(true)}
                          className="relative inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <Trash2 size={14} className="shrink-0 opacity-80" />
                          回收站
                          {selectedCanvasId && (canvasTrashByCanvasId[selectedCanvasId]?.length || 0) > 0 ? (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-medium text-white">
                              {(canvasTrashByCanvasId[selectedCanvasId]?.length || 0) > 99
                                ? '99+'
                                : canvasTrashByCanvasId[selectedCanvasId]?.length}
                            </span>
                          ) : null}
                        </button>
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {Math.round(viewport.scale * 100)}%
                        </span>
                        {savingCanvas && (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            同步中
                          </span>
                        )}
                      </div>

                      <div className="absolute inset-0" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0' }}>
                        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                          {selectedCanvas.images.map((item) => {
                            if (!item.sourceImageId) return null
                            const source = selectedCanvas.images.find((img) => img.id === item.sourceImageId)
                            if (!source) return null

                            const sourceX = source.x + 288
                            const sourceY = source.y + getPreviewHeight(source.size) / 2
                            const targetX = item.x
                            const targetY = item.y + getPreviewHeight(item.size) / 2
                            const controlOffset = Math.max(40, (targetX - sourceX) * 0.35)

                            return (
                              <path
                                key={`link-${item.id}`}
                                d={`M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`}
                                stroke="rgba(148,163,184,0.9)"
                                strokeWidth="2"
                                fill="none"
                              />
                            )
                          })}
          </svg>

                        {selectedCanvas.images.map((item) => {
                          const active = selectedImageId === item.id
                          const isImageReady = item.status === 'completed' && Boolean(item.imageUrl)
                          return (
                            <div
                              key={item.id}
                              onPointerDown={(event) => {
                                event.stopPropagation()
                                setSelectedImageId(item.id)
                              }}
                              className={`group absolute w-72 overflow-visible rounded-lg border bg-white shadow-sm dark:bg-slate-900 ${
                                active ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'
                              }`}
                              style={{ left: item.x, top: item.y }}
                            >
                              {active && (
                                <div className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2">
                                  <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/35 px-3 py-1 shadow-lg backdrop-blur-md dark:border-white/20 dark:bg-slate-900/35">
                                  <button
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      if (!isImageReady) return
                                      handleStartModify()
                                    }}
                                    disabled={!isImageReady}
                                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-slate-800 hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-white/10"
                                  >
                                    修改
                                  </button>
                                  <span className="h-3 w-px bg-slate-400/60 dark:bg-slate-500/80" />
                                  <button
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      if (!isImageReady) return
                                      handleCopyLink(item.imageUrl)
                                    }}
                                    disabled={!isImageReady}
                                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-slate-800 hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-white/10"
                                  >
                                    复制链接
                                  </button>
                                  <span className="h-3 w-px bg-slate-400/60 dark:bg-slate-500/80" />
                                  <button
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      if (!isImageReady) return
                                      handleDownloadImage(item.imageUrl)
                                    }}
                                    disabled={!isImageReady}
                                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-slate-800 hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-white/10"
                                  >
                                    下载
                                  </button>
                                  <span className="h-3 w-px bg-slate-400/60 dark:bg-slate-500/80" />
                                  <button
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => deleteImage(item.id)}
                                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-red-600 hover:bg-red-100/50 dark:text-red-300 dark:hover:bg-red-900/30"
                                  >
                                    删除
                                  </button>
        </div>
                                </div>
                              )}

                              <div className="overflow-hidden rounded-lg">
                                <div
                                  className="w-full bg-slate-100 dark:bg-slate-800"
                                  style={{ aspectRatio: `${getImageAspectRatio(item.size)}` }}
                                >
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.prompt} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                                      {item.status === 'generating'
                                        ? (
                                          <>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                              {
                                                GENERATING_TEXTS[
                                                  (generatingTick + hashString(item.id)) % GENERATING_TEXTS.length
                                                ]
                                              }
                                            </span>
                                          </>
                                        )
                                        : item.status === 'failed'
                                          ? '生成失败'
                                          : '等待图片'}
                                    </div>
                                  )}
                                </div>
                                <div className="max-h-0 overflow-hidden border-t border-slate-200 p-0 text-xs text-slate-600 opacity-0 transition-all duration-200 group-hover:max-h-24 group-hover:p-2 group-hover:opacity-100 dark:border-slate-700 dark:text-slate-300">
                                  <div className="line-clamp-2">{item.prompt}</div>
                                  <div className="mt-1 text-[10px] text-slate-400">{item.size}</div>
                                  {item.error && <div className="mt-1 text-red-500">{item.error}</div>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {false && (
                        <div
                          className="absolute right-4 top-4 z-20 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <h3 className="mb-2 text-sm font-semibold">{isModifyMode ? '修改图片提示词' : '生成图片'}</h3>
                          {isModifyMode && modifySourceImageId && (
                            <div className="mb-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              已自动带入原图作为参考图，生成结果会追加在原图后面。
                            </div>
                          )}
                          <div className="mb-3 grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">图片尺寸</label>
                              <select
                                value={imageSize}
                                onChange={(event) => setImageSize(event.target.value)}
                                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                              >
                                <option value="1024x1024">1024x1024</option>
                                <option value="1080x1920">1080x1920 竖屏</option>
                                <option value="1920x1080">1920x1080 横屏</option>
                                <option value="1024x1792">1024x1792</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">模型</label>
                              <select
                                value={imageModel}
                                onChange={(event) => setImageModel(event.target.value)}
                                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                              >
                                {modelOptions.map((model) => (
                                  <option key={model} value={model}>
                                    {model}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <label className="text-xs text-slate-500 dark:text-slate-400">参考图</label>
                            <label
                              title="上传参考图"
                              className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => handleUploadReferenceFile(event.target.files?.[0] || null)}
                              />
                              {referenceUploading ? <span className="text-[11px]">...</span> : <Plus size={16} />}
                            </label>
                          </div>
                          {referenceUploadError && <div className="mt-2 text-xs text-red-500">{referenceUploadError}</div>}

                          {referenceImages.length > 0 ? (
                            <div className="mt-2 flex gap-2 overflow-x-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
                              {referenceImages.slice(0, 1).map((url) => (
                                <div key={url} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded">
                                  <img src={url} alt="参考图" className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleRemoveReferenceImage(url)
                                    }}
                                    className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur group-hover:flex"
                                    aria-label="删除参考图"
                                    title="删除"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                              暂无参考图，可点击右侧 + 上传
                            </div>
                          )}

                          <textarea
                            value={promptText}
                            onChange={(event) => setPromptText(event.target.value)}
                            placeholder="描述你想生成的画面内容、风格、光线、构图等"
                            className="mt-3 h-36 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                          />
                          <button
                            onClick={handleGenerate}
                            disabled={isSubmitting}
                            className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                          >
                            {isSubmitting ? '生成并上传中...' : isModifyMode ? '确认修改并生成' : '生成图片'}
                          </button>
                        </div>
                      )}

                      {showPromptWindow && (
                        <div
                          className="absolute bottom-16 left-3 right-3 z-20 mx-auto max-w-[900px] rounded-2xl border border-slate-200 bg-slate-50/95 p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <div className="mt-1 flex items-start gap-2">
                            <label
                              title="参考图（点击添加或替换）"
                              className="group relative inline-flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => handleUploadReferenceFile(event.target.files?.[0] || null)}
                              />
                              {referenceImages[0] ? (
                                <>
                                  <img src={referenceImages[0]} alt="参考图" className="h-full w-full object-cover" />
                                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white transition group-hover:bg-black/35">
                                    <Plus size={16} />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      handleRemoveReferenceImage(referenceImages[0])
                                    }}
                                    className="absolute right-0 top-0 hidden h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-white group-hover:flex"
                                    title="移除参考图"
                                  >
                                    <X size={12} />
                                  </button>
                                </>
                              ) : referenceUploading ? (
                                <span className="text-[11px]">...</span>
                              ) : (
                                <Plus size={18} />
                              )}
                            </label>
                            <div className="flex-1">
                              <textarea
                                value={promptText}
                                onChange={(event) => setPromptText(event.target.value)}
                                placeholder="输入文字或 @ 主体，描述你想生成的图片。"
                                className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                              />
                            </div>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={imageModel}
                                onChange={(event) => setImageModel(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
                              >
                                {modelOptions.map((model) => (
                                  <option key={model} value={model}>
                                    {model}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={imageSize}
                                onChange={(event) => setImageSize(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="1024x1024">1:1</option>
                                <option value="1920x1080">16:9</option>
                                <option value="1080x1920">9:16</option>
                                <option value="1024x1792">9:16(长图)</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-sm font-medium text-slate-600 dark:text-slate-300">
                                {formatGenerateCostHint().costYuan}
                              </span>
                              <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={isSubmitting}
                                className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-slate-900 px-4 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                              >
                                {isSubmitting ? (
                                  '生成中...'
                                ) : (
                                  <>
                                    <ArrowUp className="h-4 w-4" />
                                    <span className="hidden sm:inline">生成</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          {referenceUploadError && <div className="mt-2 text-xs text-red-500">{referenceUploadError}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            {activeMenu === 'imageFactory' && factoryCanvasId && (
              <div className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-1 flex-col overflow-x-hidden">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/95">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">图片工厂</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">大模型由ChatGPT提供，放心食用！</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTrashModal(true)}
                    className="relative inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Trash2 size={14} />
                    回收站
                    {(canvasTrashByCanvasId[factoryCanvasId]?.length || 0) > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-medium text-white">
                        {(canvasTrashByCanvasId[factoryCanvasId]?.length || 0) > 99
                          ? '99+'
                          : canvasTrashByCanvasId[factoryCanvasId]?.length}
                      </span>
                    ) : null}
                  </button>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 px-2 py-2 pb-[5.5rem] dark:bg-slate-950 sm:pb-[6.5rem]">
                  {!factoryCanvas ? (
                    <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">正在准备对话…</div>
                  ) : factoryCanvas.images.length === 0 ? null : (
                    <div className="mx-auto w-full max-w-lg space-y-1.5">
                      {factoryCanvas.images.map((item) => {
                        const isModifyTarget = isModifyMode && modifySourceImageId === item.id
                        const isImageReady = item.status === 'completed' && Boolean(item.imageUrl)
                        return (
                          <div
                            key={item.id}
                            onPointerDown={() => setSelectedImageId(item.id)}
                            className={`overflow-hidden rounded-md border bg-white shadow-sm dark:bg-slate-900 ${
                              isModifyTarget
                                ? 'border-blue-500 ring-1 ring-blue-500/30'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="border-b border-slate-100 px-2.5 py-1 dark:border-slate-800">
                              <p className="text-[13px] leading-snug text-slate-800 dark:text-slate-100">
                                {item.prompt || '（无提示词）'}
                              </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/40">
                              {item.imageUrl ? (
                                <button
                                  type="button"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedImageId(item.id)
                                    setFactoryImageLightbox(item.imageUrl)
                                  }}
                                  className="relative aspect-[2/1] w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset dark:focus-visible:ring-offset-0"
                                  title="点击查看大图"
                                >
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <div className="flex aspect-[2/1] w-full flex-col items-center justify-center bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  {item.status === 'generating' ? (
                                    <span className="px-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
                                      {
                                        GENERATING_TEXTS[
                                          (generatingTick + hashString(item.id)) % GENERATING_TEXTS.length
                                        ]
                                      }
                                    </span>
                                  ) : item.status === 'failed' ? (
                                    '生成失败'
                                  ) : (
                                    '等待图片'
                                  )}
                                </div>
                              )}
                            </div>
                            {item.error ? (
                              <div className="border-t border-slate-100 px-2.5 py-1 text-[11px] text-red-500 dark:border-slate-800">
                                {item.error}
                              </div>
                            ) : null}
                            <div className="px-2 pb-1 pt-1">
                              <div className="flex flex-wrap items-center gap-0.5 rounded-sm border border-slate-200 bg-slate-50/90 px-1 py-1 dark:border-slate-600 dark:bg-slate-900/60">
                                <button
                                  type="button"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={() => {
                                    if (!isImageReady) return
                                    startModifyFromImage(item)
                                  }}
                                  disabled={!isImageReady}
                                  className="rounded-sm px-2 py-1 text-[11px] text-slate-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  修改
                                </button>
                                <button
                                  type="button"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={() => {
                                    if (!isImageReady) return
                                    handleCopyLink(item.imageUrl)
                                  }}
                                  disabled={!isImageReady}
                                  className="rounded-sm px-2 py-1 text-[11px] text-slate-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  复制链接
                                </button>
                                <button
                                  type="button"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={() => {
                                    if (!isImageReady) return
                                    handleDownloadImage(item.imageUrl)
                                  }}
                                  disabled={!isImageReady}
                                  className="rounded-sm px-2 py-1 text-[11px] text-slate-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  下载
                                </button>
                                <button
                                  type="button"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={() => factoryCanvasId && deleteImage(item.id, factoryCanvasId)}
                                  className="rounded-sm px-2 py-1 text-[11px] text-red-600 hover:bg-red-50/80 dark:text-red-400 dark:hover:bg-red-950/50"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={factoryChatEndRef} className="h-px" />
                    </div>
                  )}
                </div>
                <div
                  className="fixed inset-x-0 bottom-0 z-30 bg-transparent px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="mx-auto w-full min-w-0 max-w-3xl rounded-lg border border-white/50 bg-white/55 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/45 dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
                    <div className="flex min-w-0 items-start gap-2">
                      <label
                        title="参考图（点击添加或替换）"
                        className="group relative inline-flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleUploadReferenceFile(event.target.files?.[0] || null)}
                        />
                        {referenceImages[0] ? (
                          <>
                            <img src={referenceImages[0]} alt="参考图" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                handleRemoveReferenceImage(referenceImages[0])
                              }}
                              className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-white"
                              title="移除参考图"
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : referenceUploading ? (
                          <span className="text-[11px]">...</span>
                        ) : (
                          <Plus size={18} />
                        )}
                      </label>
                      <div className="min-w-0 flex-1">
                        <textarea
                          value={promptText}
                          onChange={(event) => setPromptText(event.target.value)}
                          placeholder="输入想要生成的画面…"
                          rows={isMobile ? 2 : 3}
                          className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    {isMobile ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div
                          ref={factoryMobilePickersRef}
                          className="flex min-w-0 flex-1 items-center gap-1.5"
                        >
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setFactoryMobilePick((p) => (p === 'size' ? null : 'size'))}
                              className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50/90 px-2 py-1 text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100"
                            >
                              {FACTORY_IMAGE_SIZE_OPTIONS.find((o) => o.value === imageSize)?.label ?? imageSize}
                              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                            </button>
                            {factoryMobilePick === 'size' ? (
                              <ul
                                role="listbox"
                                className="absolute bottom-full left-0 z-[60] mb-1 max-h-[min(11rem,42vh)] min-w-[6.5rem] overflow-y-auto rounded-md border border-slate-200/90 bg-white/95 py-1 shadow-lg backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/95"
                              >
                                {FACTORY_IMAGE_SIZE_OPTIONS.map((opt) => (
                                  <li key={opt.value}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={imageSize === opt.value}
                                      onClick={() => {
                                        setImageSize(opt.value)
                                        setFactoryMobilePick(null)
                                      }}
                                      className={`w-full px-3 py-2.5 text-left text-[11px] ${
                                        imageSize === opt.value
                                          ? 'bg-slate-100 font-medium dark:bg-slate-800'
                                          : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/80'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
            </li>
                                ))}
          </ul>
                            ) : null}
        </div>
                          <div className="relative max-w-[min(10rem,36vw)] min-w-0 shrink">
                            <button
                              type="button"
                              onClick={() => setFactoryMobilePick((p) => (p === 'model' ? null : 'model'))}
                              className="flex w-full max-w-full items-center gap-0.5 truncate rounded-md border border-slate-200 bg-slate-50/90 px-2 py-1 text-left text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100"
                            >
                              <span className="min-w-0 flex-1 truncate">{imageModel}</span>
                              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                            </button>
                            {factoryMobilePick === 'model' ? (
                              <ul
                                role="listbox"
                                className="absolute bottom-full left-0 z-[60] mb-1 max-h-[min(14rem,45vh)] w-max min-w-full max-w-[85vw] overflow-y-auto rounded-md border border-slate-200/90 bg-white/95 py-1 shadow-lg backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/95 sm:max-w-xs"
                              >
                                {modelOptions.map((model) => (
                                  <li key={model}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={imageModel === model}
                                      onClick={() => {
                                        setImageModel(model)
                                        setFactoryMobilePick(null)
                                      }}
                                      className={`w-full truncate px-3 py-2.5 text-left text-[11px] ${
                                        imageModel === model
                                          ? 'bg-slate-100 font-medium dark:bg-slate-800'
                                          : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/80'
                                      }`}
                                    >
                                      {model}
                                    </button>
            </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="tabular-nums text-sm font-medium text-slate-600 dark:text-slate-300">
                            {formatGenerateCostHint().costYuan}
                          </span>
                          <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isSubmitting}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-md disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                            title="生成"
                          >
                            {isSubmitting ? (
                              <span className="text-[10px]">…</span>
                            ) : (
                              <Sparkles className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={imageSize}
                            onChange={(event) => setImageSize(event.target.value)}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] outline-none dark:border-slate-600 dark:bg-slate-800"
                          >
                            <option value="1024x1024">1:1</option>
                            <option value="1920x1080">16:9</option>
                            <option value="1080x1920">9:16</option>
                            <option value="1024x1792">9:16(长)</option>
                          </select>
                        </div>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <select
                            value={imageModel}
                            onChange={(event) => setImageModel(event.target.value)}
                            className="max-w-[16rem] min-w-0 shrink rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] outline-none dark:border-slate-600 dark:bg-slate-800"
                          >
                            {modelOptions.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums text-sm font-medium text-slate-600 dark:text-slate-300">
                              {formatGenerateCostHint().costYuan}
                            </span>
                            <button
                              type="button"
                              onClick={handleGenerate}
                              disabled={isSubmitting}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-md disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                              title="生成"
                            >
                              {isSubmitting ? (
                                <span className="text-[10px]">…</span>
                              ) : (
                                <ArrowUp className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    {referenceUploadError && <div className="mt-2 text-xs text-red-500">{referenceUploadError}</div>}
                    {isModifyMode && (
                      <div className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        已选中原图，输入新描述后点击右侧按钮生成修改版本。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'system' && isAdminUser && systemSubMenu === 'interface' && (
              <div className="max-w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-semibold">接口配置</h2>
                <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <input
                      value={interfaceBaseUrl}
                      onChange={(event) => setInterfaceBaseUrl(event.target.value)}
                      placeholder="接口地址（NOW API）"
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      value={interfaceApiKey}
                      onChange={(event) => setInterfaceApiKey(event.target.value)}
                      placeholder="API Key"
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      value={interfaceModel}
                      onChange={(event) => setInterfaceModel(event.target.value)}
                      placeholder="模型（如 gpt-image-2）"
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      value={interfaceUnitCostYuan}
                      onChange={(event) => setInterfaceUnitCostYuan(event.target.value)}
                      placeholder="单次消耗（元）"
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  {settingsError && <div className="mt-2 text-sm text-red-500">{settingsError}</div>}
                  <button
                    onClick={handleCreateInterfaceConfig}
                    className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    添加接口
                  </button>
                  <div className="mt-4 space-y-2">
                    {interfaceConfigs.map((item) => (
                      <div
                        key={item.id}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="break-all">{item.baseUrl}</div>
                          <div className="text-xs text-slate-500">
                            {item.model} · 单次 ¥{(Number(item.unitCostCents || 0) / 100).toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteInterfaceConfig(item.id)}
                          className="shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'system' && isAdminUser && systemSubMenu === 'system' && (
              <div className="max-w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-semibold">系统设置</h2>
                <div className="mt-3 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSystemSettingsTab('general')}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      systemSettingsTab === 'general'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    系统设置
                  </button>
                  <button
                    type="button"
                    onClick={() => setSystemSettingsTab('register')}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      systemSettingsTab === 'register'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    用户注册
                  </button>
                  <button
                    type="button"
                    onClick={() => setSystemSettingsTab('payment')}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      systemSettingsTab === 'payment'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    支付配置
                  </button>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  {systemSettingsTab === 'general' && (
                    <div className="space-y-2 text-sm">
                      <label className="block text-xs text-slate-500">网站标题</label>
                      <input
                        value={systemSettings.siteTitle}
                        onChange={(event) =>
                          setSystemSettings((prev) => ({ ...prev, siteTitle: event.target.value }))
                        }
                        placeholder="显示在侧栏、登录页与浏览器标题"
                        className="w-full max-w-md rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        保存后全站展示此标题（未登录用户也会从服务器读取）。
                      </p>
                    </div>
                  )}
                  {systemSettingsTab === 'payment' && (
                    <div className="space-y-3 text-sm">
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        对接易支付发起接口（
                        <a
                          href="https://www.mzafu2.cn/doc/epay_submit"
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline dark:text-blue-400"
                        >
                          文档说明
                        </a>
                        ），支持异步 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">notify</code> 与同步{' '}
                        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">return</code>
                        ，PC 与移动端自动区分设备参数。请在下方填写易支付商户 ID、密钥及{' '}
                        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">submit.php</code> 完整地址。
                      </p>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">支付方式</label>
                        <select
                          value={systemSettings.payProvider}
                          onChange={(event) =>
                            setSystemSettings((prev) => ({
                              ...prev,
                              payProvider: event.target.value === 'epay' ? 'epay' : 'none',
                            }))
                          }
                          className="w-full max-w-xs rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="none">关闭在线充值</option>
                          <option value="epay">易支付</option>
                        </select>
                      </div>
                      {systemSettings.payProvider === 'epay' ? (
                        <div className="space-y-2">
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">submit.php 完整 URL</label>
                            <input
                              value={systemSettings.epaySubmitUrl}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, epaySubmitUrl: event.target.value }))
                              }
                              placeholder="https://你的易支付域名/submit.php"
                              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">商户 ID（pid）</label>
                            <input
                              value={systemSettings.epayPid}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, epayPid: event.target.value }))
                              }
                              placeholder="易支付商户 ID"
                              className="w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">商户密钥（key）</label>
                            <input
                              type="password"
                              value={systemSettings.epayKey}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, epayKey: event.target.value }))
                              }
                              placeholder={systemSettings.epayKeySet ? '已配置，留空则不修改' : '易支付商户密钥'}
                              className="w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            异步通知：<code className="break-all">…/api/pay/epay/notify</code>；同步跳转由后端{' '}
                            <code className="break-all">…/api/pay/epay/return</code> 验签后重定向到前端并带{' '}
                            <code>?recharge=1</code>。生产环境请配置 <code>PUBLIC_APP_URL</code>（notify/return 域名）与{' '}
                            <code>FRONTEND_URL</code>（SPA 地址）；本地开发未配置时默认跳转到{' '}
                            <code>http://localhost:5173</code>。
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {systemSettingsTab === 'register' && (
                  <div className="space-y-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={systemSettings.allowUserRegister}
                        onChange={(event) =>
                          setSystemSettings((prev) => ({ ...prev, allowUserRegister: event.target.checked }))
                        }
                      />
                      <span>用户注册</span>
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">注册方式</label>
                        <select
                          value={systemSettings.registerMode}
                          onChange={(event) =>
                            setSystemSettings((prev) => ({
                              ...prev,
                              registerMode:
                                event.target.value === 'email_verification' ? 'email_verification' : 'default',
                            }))
                          }
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="default">仅用户名 + 密码</option>
                          <option value="email_verification">用户名 + 密码 + 邮箱验证码</option>
                        </select>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          选择「邮箱验证码」时，须在下方配置 SMTP，用户注册需填写邮箱并收验证码。
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">新用户赠送余额（元）</label>
                        <input
                          value={systemSettings.registerGiftYuan}
                          onChange={(event) =>
                            setSystemSettings((prev) => ({ ...prev, registerGiftYuan: event.target.value }))
                          }
                          placeholder="0"
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={systemSettings.emailVerificationEnabled}
                        onChange={(event) =>
                          setSystemSettings((prev) => ({ ...prev, emailVerificationEnabled: event.target.checked }))
                        }
                      />
                      <span>兼容：单独启用「邮箱验证」开关（与注册方式并存，发信配置见下）</span>
                    </label>

                    {(systemSettings.emailVerificationEnabled ||
                      systemSettings.registerMode === 'email_verification') && (
                      <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <select
                            value={systemSettings.emailProvider}
                            onChange={(event) =>
                              setSystemSettings((prev) => ({
                                ...prev,
                                emailProvider: event.target.value === 'qq' ? 'qq' : 'custom',
                              }))
                            }
                            className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                          >
                            <option value="custom">自定义SMTP</option>
                            <option value="qq">QQ邮箱（预置）</option>
                          </select>
                          <button
                            onClick={applyQqPreset}
                            type="button"
                            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            应用QQ预置
                          </button>
                          <button
                            onClick={() => setShowEmailTemplateEditor(true)}
                            type="button"
                            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            发件模板（可视化）
                          </button>
                        </div>

                        {systemSettings.emailProvider === 'qq' ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={systemSettings.smtpUser}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({
                                  ...prev,
                                  smtpUser: event.target.value,
                                  verifyFromEmail: toQqEmail(event.target.value),
                                }))
                              }
                              placeholder="QQ号（或QQ邮箱）"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={systemSettings.smtpPass}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpPass: event.target.value }))
                              }
                              placeholder="QQ邮箱授权码"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={systemSettings.smtpHost}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpHost: event.target.value }))
                              }
                              placeholder="SMTP Host"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={systemSettings.smtpPort}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpPort: event.target.value }))
                              }
                              placeholder="SMTP Port"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={systemSettings.smtpHost}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpHost: event.target.value }))
                              }
                              placeholder="SMTP Host"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={systemSettings.smtpPort}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpPort: event.target.value }))
                              }
                              placeholder="SMTP Port"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={systemSettings.smtpUser}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpUser: event.target.value }))
                              }
                              placeholder="SMTP 用户名"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={systemSettings.smtpPass}
                              onChange={(event) =>
                                setSystemSettings((prev) => ({ ...prev, smtpPass: event.target.value }))
                              }
                              placeholder="SMTP 密码"
                              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        )}

                        <input
                          value={systemSettings.verifyFromEmail}
                          onChange={(event) =>
                            setSystemSettings((prev) => ({ ...prev, verifyFromEmail: event.target.value }))
                          }
                          placeholder="发件邮箱"
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={systemSettings.smtpSecure}
                            onChange={(event) =>
                              setSystemSettings((prev) => ({ ...prev, smtpSecure: event.target.checked }))
                            }
                          />
                          <span className="text-xs text-slate-500">SMTP Secure</span>
                        </label>
                      </div>
                    )}
                  </div>
                  )}
                  {settingsError && <div className="mt-2 text-sm text-red-500">{settingsError}</div>}
                  <button
                    onClick={handleSaveSystemSettings}
                    className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    保存系统设置
                  </button>
                </div>
              </div>
            )}

            {activeMenu === 'recharge' && (
              <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-3 py-3 sm:gap-5 sm:p-4">
                <div className="mx-auto w-full max-w-md shrink-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="text-base font-semibold sm:text-lg">余额充值</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    当前余额：¥{((authUser.balanceCents || 0) / 100).toFixed(2)}
                  </p>
                  {!payEnabled ? (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                      管理员尚未开启在线充值，或未完成易支付配置。
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">金额（元）</label>
                        <input
                          value={rechargeAmount}
                          onChange={(event) => setRechargeAmount(event.target.value)}
                          type="number"
                          inputMode="decimal"
                          min={0.01}
                          step={0.01}
                          className="min-h-11 w-full rounded-md border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 sm:text-sm"
                        />
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        支付方式：支付宝
                      </div>
                      {rechargeError ? <div className="text-sm text-red-500">{rechargeError}</div> : null}
                      <button
                        type="button"
                        onClick={() => void handleRechargePay()}
                        disabled={rechargeSubmitting}
                        className="min-h-11 w-full rounded-md bg-slate-900 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 sm:text-sm"
                      >
                        {rechargeSubmitting ? '跳转中…' : '去支付'}
                      </button>
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        支付完成后将自动跳转回本页并刷新余额与订单；异步通知与同步回跳均会入账。
                      </p>
                    </div>
                  )}
                </div>
                <div className="min-h-0 shrink-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold sm:text-base">充值记录</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">最近在线充值（含待支付与已支付）</p>
                  {rechargeOrders.length === 0 ? (
                    <div className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      暂无充值记录
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 space-y-2 md:hidden">
                        {rechargeOrders.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                ¥{(row.moneyCents / 100).toFixed(2)}
                              </span>
                              <span>
                                {row.status === 'paid' ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                    已支付
                                  </span>
                                ) : row.status === 'pending' ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                                    待支付
                                  </span>
                                ) : (
                                  <span className="text-xs">{row.status}</span>
                                )}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                              {row.payType === 'wxpay' ? '微信支付' : '支付宝'}
                            </div>
                            <div className="mt-1 break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              单号 {row.outTradeNo}
                            </div>
                            {row.tradeNo ? (
                              <div className="mt-1 break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                平台 {row.tradeNo}
                              </div>
                            ) : null}
                            <div className="mt-2 text-[11px] text-slate-400">
                              创建 {new Date(row.createdAt).toLocaleString()}
                              {row.paidAt ? (
                                <span className="mt-0.5 block">支付 {new Date(row.paidAt).toLocaleString()}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              <th className="py-2 pr-2 font-medium">单号</th>
                              <th className="py-2 pr-2 font-medium">金额</th>
                              <th className="py-2 pr-2 font-medium">方式</th>
                              <th className="py-2 pr-2 font-medium">状态</th>
                              <th className="py-2 pr-2 font-medium">平台单号</th>
                              <th className="py-2 font-medium">创建 / 支付时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rechargeOrders.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="py-2 pr-2 font-mono text-[11px]">{row.outTradeNo}</td>
                                <td className="py-2 pr-2">¥{(row.moneyCents / 100).toFixed(2)}</td>
                                <td className="py-2 pr-2">{row.payType === 'wxpay' ? '微信' : '支付宝'}</td>
                                <td className="py-2 pr-2">
                                  {row.status === 'paid' ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">已支付</span>
                                  ) : row.status === 'pending' ? (
                                    <span className="text-amber-600 dark:text-amber-400">待支付</span>
                                  ) : (
                                    row.status
                                  )}
                                </td>
                                <td className="max-w-[10rem] truncate py-2 pr-2 font-mono text-[11px] text-slate-500">
                                  {row.tradeNo || '—'}
                                </td>
                                <td className="py-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <div>{new Date(row.createdAt).toLocaleString()}</div>
                                  {row.paidAt ? (
                                    <div>支付 {new Date(row.paidAt).toLocaleString()}</div>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeMenu === 'users' && isAdminUser && (
              <div className="h-full max-w-full space-y-3 overflow-y-auto overflow-x-hidden px-2 py-2 sm:p-4">
                <h2 className="text-lg font-semibold">用户管理</h2>
                {adminUsersError ? <div className="text-sm text-red-500">{adminUsersError}</div> : null}
                {adminUsersLoading ? (
                  <div className="text-sm text-slate-500">加载中…</div>
                ) : (
                  <>
                    <div className="space-y-2 md:hidden">
                      {adminUsers.map((u) => (
                        <div
                          key={u.id}
                          className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{u.username}</div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                ID {u.id} · {u.role === 'admin' ? '管理员' : '用户'}
                                {u.banned ? <span className="text-red-600"> · 已封禁</span> : null}
                              </div>
                            </div>
                            <div className="shrink-0 font-medium">¥{(u.balanceCents / 100).toFixed(2)}</div>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-400">{new Date(u.createdAt).toLocaleString()}</div>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {u.role !== 'admin' ? (
                              <button
                                type="button"
                                onClick={() => void toggleUserBanned(u, !u.banned)}
                                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                              >
                                {u.banned ? '解封' : '封禁'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openAdminBalanceModal(u)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                            >
                              加余额
                            </button>
                            <button
                              type="button"
                              onClick={() => void openAdminHistoryModal(u)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                            >
                              余额流水
                            </button>
                            <button
                              type="button"
                              onClick={() => void openAdminGenModal(u)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                            >
                              生成记录
                            </button>
                            <button
                              type="button"
                              onClick={() => void resetUserPasswordAdmin(u)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                            >
                              重置密码
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 md:block">
                      <table className="w-full border-collapse text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                            <th className="px-3 py-2 font-medium">ID</th>
                            <th className="px-3 py-2 font-medium">用户名</th>
                            <th className="px-3 py-2 font-medium">角色</th>
                            <th className="px-3 py-2 font-medium">余额</th>
                            <th className="px-3 py-2 font-medium">状态</th>
                            <th className="px-3 py-2 font-medium">注册时间</th>
                            <th className="px-3 py-2 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers.map((u) => (
                            <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2">{u.id}</td>
                              <td className="px-3 py-2 font-medium">{u.username}</td>
                              <td className="px-3 py-2">{u.role === 'admin' ? '管理员' : '用户'}</td>
                              <td className="px-3 py-2">¥{(u.balanceCents / 100).toFixed(2)}</td>
                              <td className="px-3 py-2">{u.banned ? <span className="text-red-600">已封禁</span> : '正常'}</td>
                              <td className="px-3 py-2 text-[11px] text-slate-500">{new Date(u.createdAt).toLocaleString()}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {u.role !== 'admin' ? (
                                    <button
                                      type="button"
                                      onClick={() => void toggleUserBanned(u, !u.banned)}
                                      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                                    >
                                      {u.banned ? '解封' : '封禁'}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => openAdminBalanceModal(u)}
                                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                                  >
                                    加余额
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void openAdminHistoryModal(u)}
                                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                                  >
                                    余额流水
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void openAdminGenModal(u)}
                                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                                  >
                                    生成记录
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void resetUserPasswordAdmin(u)}
                                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                                  >
                                    重置密码
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeMenu === 'records' && (
              <div className="max-w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-base font-semibold">生成记录</h2>
                <div className="mt-3 space-y-2">
                  {generationRecords.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      暂无生成记录
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 md:hidden">
                        {generationRecords.map((item) => {
                          const statusText =
                            item.status === 'completed' ? '成功' : item.status === 'failed' ? '失败' : item.status
                          const statusClass =
                            item.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : item.status === 'failed'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          return (
                            <div
                              key={item.id}
                              className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40"
                            >
                              <div className="line-clamp-3 font-medium text-slate-900 dark:text-slate-100">{item.prompt}</div>
                              {item.errorMessage ? (
                                <div className="mt-1 text-xs text-red-500">{item.errorMessage}</div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <span>
                                  {item.model} · {item.size}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass}`}>{statusText}</span>
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                                  ¥{(Number(item.costCents || 0) / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="mt-2 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="hidden space-y-2 md:block">
                        <div className="grid grid-cols-[minmax(0,1.6fr)_0.9fr_0.7fr_0.7fr_1fr] gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                          <div>提示词</div>
                          <div>模型/尺寸</div>
                          <div>状态</div>
                          <div>消耗</div>
                          <div>时间</div>
                        </div>
                        {generationRecords.map((item) => {
                          const statusText =
                            item.status === 'completed' ? '成功' : item.status === 'failed' ? '失败' : item.status
                          const statusClass =
                            item.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : item.status === 'failed'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[minmax(0,1.6fr)_0.9fr_0.7fr_0.7fr_1fr] items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                            >
                              <div className="min-w-0">
                                <div className="line-clamp-2 font-medium">{item.prompt}</div>
                                {item.errorMessage && <div className="mt-1 text-xs text-red-500">{item.errorMessage}</div>}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                <div>{item.model}</div>
                                <div>{item.size}</div>
                              </div>
                              <div>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{statusText}</span>
                              </div>
                              <div>
                                <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                  ¥{(Number(item.costCents || 0) / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
      </section>
        </main>

        {userMgmtModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setUserMgmtModal(null)}
            onKeyDown={(e) => e.key === 'Escape' && setUserMgmtModal(null)}
            role="presentation"
          >
            <div
              className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">
                    {userMgmtModal.mode === 'balance'
                      ? '调整余额'
                      : userMgmtModal.mode === 'history'
                        ? '余额流水'
                        : '图片生成记录'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">用户：{userMgmtModal.user.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUserMgmtModal(null)}
                  className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  关闭
                </button>
              </div>
              {adminUsersError ? <div className="mt-2 text-sm text-red-500">{adminUsersError}</div> : null}
              {userMgmtModal.mode === 'balance' ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">金额（元），正数为增加，负数为扣减</label>
                    <input
                      value={adminBalanceYuan}
                      onChange={(e) => setAdminBalanceYuan(e.target.value)}
                      type="number"
                      step={0.01}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">备注（可选）</label>
                    <input
                      value={adminBalanceNote}
                      onChange={(e) => setAdminBalanceNote(e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={adminModalLoading}
                    onClick={() => void submitAdminBalance()}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {adminModalLoading ? '提交中…' : '确认调整'}
                  </button>
                </div>
              ) : null}
              {userMgmtModal.mode === 'history' ? (
                <div className="mt-4">
                  {adminModalLoading ? (
                    <div className="text-sm text-slate-500">加载中…</div>
                  ) : adminHistoryRows.length === 0 ? (
                    <div className="text-sm text-slate-500">暂无流水</div>
                  ) : (
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
                      {adminHistoryRows.map((row, idx) => (
                        <div
                          key={`${row.kind}-${row.ref}-${idx}`}
                          className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
                        >
                          <div>
                            <span className="text-xs text-slate-500">
                              {row.kind === 'recharge' ? '充值' : row.kind === 'generation' ? '生成' : '管理员'}
                            </span>
                            <div className="mt-0.5 text-slate-700 dark:text-slate-200">{row.label}</div>
                            <div className="text-[11px] text-slate-400">{new Date(row.at).toLocaleString()}</div>
                          </div>
                          <div
                            className={
                              row.deltaCents >= 0
                                ? 'font-medium text-emerald-600 dark:text-emerald-400'
                                : 'font-medium text-red-600 dark:text-red-400'
                            }
                          >
                            {row.deltaCents >= 0 ? '+' : ''}
                            ¥{(row.deltaCents / 100).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {userMgmtModal.mode === 'records' ? (
                <div className="mt-4">
                  {adminModalLoading ? (
                    <div className="text-sm text-slate-500">加载中…</div>
                  ) : adminGenRows.length === 0 ? (
                    <div className="text-sm text-slate-500">暂无生成记录</div>
                  ) : (
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto text-xs">
                      {adminGenRows.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-slate-100 p-2 dark:border-slate-800"
                        >
                          <div className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{item.prompt}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                            <span>{item.model}</span>
                            <span>{item.size}</span>
                            <span>状态 {item.status}</span>
                            <span>¥{(item.costCents / 100).toFixed(2)}</span>
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          {item.errorMessage ? (
                            <div className="mt-1 text-[11px] text-red-500">{item.errorMessage}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showAvatarModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-base font-semibold">修改头像</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-[240px_1fr]">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">当前头像</div>
                  <div className="mt-2">
                    {authUser?.avatarUrl ? (
                      <img
                        src={authUser.avatarUrl}
                        alt="当前头像"
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500 dark:bg-slate-700">
                        无头像
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                    输入提示词生成头像（每日最多 3 次）
                    {avatarRemaining !== null ? `，剩余 ${avatarRemaining} 次` : ''}
                  </div>
                  <textarea
                    value={avatarPrompt}
                    onChange={(event) => setAvatarPrompt(event.target.value)}
                    placeholder="输入头像提示词，例如：简洁扁平风格蓝色科技感头像"
                    className="h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                  {generatedAvatarUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={generatedAvatarUrl}
                        alt="生成头像预览"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <span className="text-xs text-slate-500">已生成，可点击“设置头像”</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-800">
                  头像仓库
                </div>
                <div className="max-h-48 overflow-auto">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {avatarRepo.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedAvatarUrl(item.imageUrl)}
                        className={`overflow-hidden rounded-md border ${
                          selectedAvatarUrl === item.imageUrl
                            ? 'border-blue-500 ring-1 ring-blue-300'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        title={`${item.creatorUsername}: ${item.prompt}`}
                      >
                        <img src={item.imageUrl} alt="仓库头像" className="h-14 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAvatarModal(false)
                    setAvatarPrompt('')
                    setGeneratedAvatarUrl(null)
                    setSelectedAvatarUrl(null)
                  }}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  onClick={handleGenerateAvatar}
                  disabled={avatarGenerating}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {avatarGenerating ? '生成中...' : '生成头像'}
                </button>
                <button
                  onClick={handleApplyAvatar}
                  disabled={!selectedAvatarUrl}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  设置头像
                </button>
              </div>
            </div>
          </div>
        )}

        {showAlbumParserModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">图集解析</h3>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    限时免费
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    原价 <span className="line-through">0.01</span>
                  </span>
                </div>
                <button
                  onClick={() => setShowAlbumParserModal(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  关闭
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={albumInput}
                  onChange={(event) => setAlbumInput(event.target.value)}
                  placeholder="粘贴抖音分享文案或链接"
                  className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  onClick={handlePasteAlbumText}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  粘贴
                </button>
                <button
                  onClick={handleParseAlbum}
                  disabled={albumParsing}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  {albumParsing ? '解析中...' : '解析'}
                </button>
              </div>
              {albumParseError && <div className="mt-2 text-xs text-red-500">{albumParseError}</div>}
              

              <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {albumCandidates.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">解析后可在这里选择图片</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {albumCandidates.map((url) => {
                      const active = selectedAlbumUrls.includes(url)
                      return (
                        <button
                          key={url}
                          onClick={() => toggleAlbumSelect(url)}
                          className={`overflow-hidden rounded-md border text-left ${active ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-200 dark:border-slate-700'}`}
                        >
                          <img src={url} alt="解析图片" className="h-36 w-full object-cover" />
                          <div className="px-2 py-1 text-[11px]">{active ? '已选择' : '点击选择'}</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">已选 {selectedAlbumUrls.length} 张，插入时会自动上传公共图库</span>
                <button
                  onClick={handleInsertParsedImages}
                  disabled={selectedAlbumUrls.length === 0 || albumImporting}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  {albumImporting ? '上传并插入中...' : '插入画布'}
                </button>
              </div>
            </div>
          </div>
        )}

        {factoryImageLightbox ? (
          <div
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
            onClick={() => setFactoryImageLightbox(null)}
            onPointerDown={(event) => event.stopPropagation()}
                  role="presentation"
          >
            <button
              type="button"
              aria-label="关闭预览"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25"
              onClick={(event) => {
                event.stopPropagation()
                setFactoryImageLightbox(null)
              }}
            >
              <X size={22} />
            </button>
            <img
              src={factoryImageLightbox}
              alt=""
              className="max-h-[min(92vh,920px)] max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}

        {showTrashModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">回收站</h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    恢复时使用删除前保存的坐标与修改关系，会回到原来的主列或修改链位置。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrashModal(false)}
                  className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="关闭"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {!trashCanvasId ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无可用的画布上下文</div>
                ) : (canvasTrashByCanvasId[trashCanvasId] || []).length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">当前回收站为空</div>
                ) : (
                  <ul className="space-y-2">
                    {(canvasTrashByCanvasId[trashCanvasId] || []).map((item) => {
                      const alreadyOnCanvas = Boolean(
                        canvases.find((c) => c.id === trashCanvasId)?.images.some((img) => img.id === item.id),
                      )
                      return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">无图</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                item.sourceImageId
                                  ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {item.sourceImageId ? '修改图' : '主图'}
                            </span>
                            <span className="text-[10px] text-slate-400">{item.size}</span>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-xs text-slate-700 dark:text-slate-200">
                            {item.prompt || '（无提示词）'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreFromTrash(item.id)}
                          disabled={alreadyOnCanvas}
                          title={alreadyOnCanvas ? '画布上已有该图' : undefined}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
                        >
                          <RotateCcw size={12} />
                          {alreadyOnCanvas ? '已在画布' : '恢复'}
                        </button>
            </li>
                      )
                    })}
          </ul>
                )}
        </div>
              {trashCanvasId && (canvasTrashByCanvasId[trashCanvasId] || []).length > 0 ? (
                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('确定清空当前回收站？清空后这些条目将无法再从此处恢复。')) return
                      clearCurrentCanvasTrash()
                    }}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    清空回收站
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {showEmailTemplateEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">邮箱发件模板（可视化）</h3>
                <button
                  onClick={() => setShowEmailTemplateEditor(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  关闭
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs text-slate-500">邮件标题</label>
                  <input
                    value={systemSettings.emailSubjectTemplate}
                    onChange={(event) =>
                      setSystemSettings((prev) => ({ ...prev, emailSubjectTemplate: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <label className="block text-xs text-slate-500">邮件HTML内容</label>
                  <textarea
                    value={systemSettings.emailHtmlTemplate}
                    onChange={(event) =>
                      setSystemSettings((prev) => ({ ...prev, emailHtmlTemplate: event.target.value }))
                    }
                    className="h-64 w-full resize-none rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <div className="text-[11px] text-slate-400">
                    可用变量：{'{{code}}'}、{'{{username}}'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">预览</label>
                  <div className="mt-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                    <div className="mb-2 text-sm font-medium">
                      {systemSettings.emailSubjectTemplate
                        .replaceAll('{{code}}', '123456')
                        .replaceAll('{{username}}', 'demo_user')}
                    </div>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: systemSettings.emailHtmlTemplate
                          .replaceAll('{{code}}', '123456')
                          .replaceAll('{{username}}', 'demo_user'),
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowEmailTemplateEditor(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
