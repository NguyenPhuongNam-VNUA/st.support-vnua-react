'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  InputAdornment,
  IconButton,
  Chip,
  Autocomplete,
} from '@mui/material';
import {
  Sliders,
  Save,
  Pencil,
  Terminal,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Cpu,
  Key,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';

export default function AgentSettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState(
    `Bạn là AI Agent tư vấn hỗ trợ sinh viên chính thức của Khoa Công nghệ Thông tin - Học viện Nông nghiệp Việt Nam (VNUA).
Nhiệm vụ của bạn là giải đáp chính xác, văn minh, lịch sự các thắc mắc về học vụ, quy chế đào tạo, học phí, tuyển sinh và ký túc xá dựa trên tài liệu được cung cấp.
Nếu câu hỏi không nằm trong tri thức hoặc độ tự tin dưới ngưỡng, hãy từ chối lịch sự và hướng dẫn sinh viên liên hệ Văn phòng Khoa.`
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [temperature, setTemperature] = useState(0.2);
  const [strictScope, setStrictScope] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState('AIzaSyD-VNUA_GeminiKey_2026_Secured');
  const [showApiKey, setShowApiKey] = useState(false);
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-004');
  const [testApiSuccess, setTestApiSuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Multi-Agent states with individual sub-agent settings
  const [enableMultiAgent, setEnableMultiAgent] = useState(true);
  const [editingSubAgents, setEditingSubAgents] = useState<Record<string, boolean>>({});
  const [subAgents, setSubAgents] = useState([
    {
      id: 'academic',
      name: 'Agent Học vụ & Quy chế',
      model: 'gemini-1.5-flash',
      kb: 'Knowledge_HocVu_v2.pdf',
      prompt: 'Bạn là Agent chuyên sâu giải đáp quy chế đào tạo, đăng ký tín chỉ và hoãn thi cho sinh viên VNUA.',
      apiKey: '',
      status: 'Active',
    },
    {
      id: 'tuition',
      name: 'Agent Học phí & Miễn giảm',
      model: 'gemini-1.5-flash',
      kb: 'QuyDinh_HocPhi_Agribank.pdf',
      prompt: 'Bạn là Agent chuyên tư vấn thời hạn đóng học phí, số tài khoản Agribank và chính sách miễn giảm.',
      apiKey: '',
      status: 'Active',
    },
    {
      id: 'dormitory',
      name: 'Agent Ký túc xá & Đời sống',
      model: 'gemini-1.5-flash',
      kb: 'NoiQuy_KTX_KhuB.docx',
      prompt: 'Bạn là Agent hướng dẫn quy định đăng ký phòng ở KTX Khu B, nội quy sinh hoạt và quản lý ký túc xá.',
      apiKey: '',
      status: 'Active',
    },
    {
      id: 'admissions',
      name: 'Agent Tuyển sinh & Hướng nghiệp',
      model: 'gemini-1.5-pro',
      kb: 'ThongTin_TuyenSinh_2026.pdf',
      prompt: 'Bạn là Agent chuyên tư vấn phương thức tuyển sinh, điểm chuẩn các năm và thông tin học bổng đầu vào.',
      apiKey: '',
      status: 'Active',
    },
  ]);

  const toggleEditSubAgent = (id: string) => {
    setEditingSubAgents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSubAgent = (id: string, field: string, value: string) => {
    setSubAgents((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const MODEL_OPTIONS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'gpt-4o-mini',
    'gpt-4o',
    'claude-3-5-sonnet-20241022',
  ];

  const EMBEDDING_OPTIONS = [
    'text-embedding-004',
    'text-embedding-3-small',
    'text-embedding-3-large',
    'bge-m3',
  ];

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestApi = () => {
    setTestApiSuccess(true);
    setTimeout(() => setTestApiSuccess(false), 3000);
  };

  return (
    <Box width="100%">
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1.5} mb={1}>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}>
              Cấu hình Hành vi & Tinh chỉnh AI Agent
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Tùy chỉnh System Prompt, chọn mô hình LLM, cấu hình API Key, kiến trúc Multi-Agent và ngưỡng tự tin
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Success Notification Banner */}
      {savedSuccess && (
        <Box display="flex" alignItems="center" gap={1.5} p={2} mb={3} bgcolor="#ecfdf5" sx={{ borderRadius: '8px' }}>
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <Typography variant="body2" fontWeight={700} sx={{ color: '#047857' }}>
            Đã lưu thành công cấu hình Agent! Hệ thống RAG & Multi-Agent đã được cập nhật tham số mới.
          </Typography>
        </Box>
      )}

      {/* Settings Form Container */}
      <Box className="bg-white" p={3.5} border="1px solid #e2e8f0" sx={{ borderRadius: '12px' }}>
        {/* Section 1: System Prompt Editor */}
        <Box mb={4}>
          <Typography variant="subtitle1" fontWeight={800} color="slate.900" mb={0.5}>
            1. System Prompt (Chỉ thị hệ thống cho Model LLM)
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Định hình tính cách, vai trò và nguyên tắc trả lời chính thức của Agent khi tư vấn cho sinh viên.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={5}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.875rem' } }}
          />
        </Box>

        <Divider sx={{ my: 3.5 }} />

        {/* Section 2: Model & API Key Configuration */}
        <Box mb={4}>
          <Typography variant="subtitle1" fontWeight={800} color="slate.900" mb={0.5}>
            2. Mô hình AI Engine & Cấu hình API Key
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
            Lựa chọn từ danh sách hoặc tự nhập tên mô hình ngôn ngữ tùy chỉnh (LLM) và API Key.
          </Typography>

          <Box display="flex" flexDirection="column" gap={2.5}>
            {/* LLM Selection / Free Typing */}
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box maxWidth={450}>
                <Typography variant="body2" fontWeight={700} color="slate.900">
                  Mô hình LLM chính (Chọn hoặc Tự nhập):
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Có thể chọn mô hình có sẵn hoặc nhập custom model ID (ví dụ: `gemini-2.0-flash-exp`).
                </Typography>
              </Box>
              <Autocomplete
                freeSolo
                options={MODEL_OPTIONS}
                value={selectedModel}
                onChange={(_, newValue) => {
                  if (newValue) setSelectedModel(newValue);
                }}
                onInputChange={(_, newInputValue) => {
                  setSelectedModel(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Chọn hoặc gõ tên mô hình..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.875rem' } }}
                  />
                )}
                sx={{ minWidth: 320, flex: 1, maxWidth: 400 }}
              />
            </Box>

            {/* API Key Field */}
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box maxWidth={450}>
                <Typography variant="body2" fontWeight={700} color="slate.900">
                  Google Gemini / OpenAI API Key:
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Khóa API bảo mật kết nối trực tiếp đến backend AI Engine RAG.
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1} minWidth={300} flex={1} maxWidth={400}>
                <TextField
                  fullWidth
                  size="small"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Key className="w-4 h-4 text-slate-400" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)} edge="end">
                          {showApiKey ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.85rem' } }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleTestApi}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    borderColor: '#2563eb',
                    color: '#2563eb',
                    py: 0.8,
                    px: 2,
                  }}
                >
                  Thử kết nối
                </Button>
              </Box>
            </Box>

            {testApiSuccess && (
              <Box display="flex" alignItems="center" gap={1} py={0.8} px={1.5} bgcolor="#ecfdf5" width="fit-content" sx={{ borderRadius: '8px' }}>
                <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <Typography variant="caption" fontWeight={700} sx={{ color: '#047857' }}>
                  Kết nối API Key thành công! Độ trễ phản hồi với [{selectedModel}]: 142ms.
                </Typography>
              </Box>
            )}

            {/* Embedding Model Selection / Free Typing */}
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box maxWidth={450}>
                <Typography variant="body2" fontWeight={700} color="slate.900">
                  Mô hình Vector Embedding (Chọn hoặc Tự nhập):
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dùng để chuyển đổi tài liệu quy chế thành Vector DB trong ChromaDB / FAISS.
                </Typography>
              </Box>
              <Autocomplete
                freeSolo
                options={EMBEDDING_OPTIONS}
                value={embeddingModel}
                onChange={(_, newValue) => {
                  if (newValue) setEmbeddingModel(newValue);
                }}
                onInputChange={(_, newInputValue) => {
                  setEmbeddingModel(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Chọn hoặc gõ mô hình embedding..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.875rem' } }}
                  />
                )}
                sx={{ minWidth: 320, flex: 1, maxWidth: 400 }}
              />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3.5 }} />

        {/* Section 3: Multi-Agent Orchestration & Per-SubAgent Settings */}
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle1" fontWeight={800} color="slate.900">
              3. Kiến trúc Multi-Agent (Routing & Tùy chỉnh từng Sub-Agent)
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={enableMultiAgent}
                  onChange={(e) => setEnableMultiAgent(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" fontWeight={800} color="primary.main">
                  {enableMultiAgent ? 'Đang bật Multi-Agent' : 'Chỉ dùng Single Agent'}
                </Typography>
              }
            />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
            Phân chia nhiệm vụ xử lý cho Router Supervisor Agent và cấu hình riêng biệt từng Sub-Agent chuyên sâu.
          </Typography>

          {enableMultiAgent && (
            <Box display="flex" flexDirection="column" gap={2.5}>
              {/* Router Agent Info Card */}
              <Box p={2.5} bgcolor="#f8fafc" border="1px solid #e2e8f0" sx={{ borderRadius: '8px' }} display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="body2" fontWeight={800} color="slate.900">
                    Supervisor / Router Agent (Agent Điều phối Trung tâm)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tự động phân tích ý định câu hỏi của sinh viên và phân luồng chính xác tới Sub-Agent tương ứng.
                  </Typography>
                </Box>
                <Chip label="Router Active" size="small" sx={{ borderRadius: '9999px', bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 800 }} />
              </Box>

              {/* Sub-Agents Grid with Full Configuration for Each Sub-Agent */}
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1fr 1fr' }} gap={2.5} mt={1}>
                {subAgents.map((agent) => {
                  const isEditing = !!editingSubAgents[agent.id];
                  return (
                    <Box
                      key={agent.id}
                      p={2.5}
                      border="1px solid #e2e8f0"
                      bgcolor={isEditing ? '#ffffff' : '#f8fafc'}
                      sx={{ borderRadius: '8px', transition: 'all 0.2s ease-in-out' }}
                      display="flex"
                      flexDirection="column"
                      gap={2}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight={800} color="slate.900">
                            {agent.name}
                          </Typography>
                          <Chip label={agent.status} size="small" sx={{ borderRadius: '9999px', bgcolor: '#ecfdf5', color: '#047857', fontWeight: 800, fontSize: '0.675rem' }} />
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => toggleEditSubAgent(agent.id)}
                          title={isEditing ? 'Lưu cấu hình Sub-Agent' : 'Chỉnh sửa Sub-Agent'}
                          sx={{
                            borderRadius: '6px',
                            p: 0.8,
                            color: isEditing ? '#ffffff' : '#2563eb',
                            bgcolor: isEditing ? '#2563eb' : '#eff6ff',
                            border: '1px solid',
                            borderColor: isEditing ? '#2563eb' : '#bfdbfe',
                            '&:hover': {
                              bgcolor: isEditing ? '#1d4ed8' : '#dbeafe',
                            },
                          }}
                        >
                          {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </IconButton>
                      </Box>

                      {/* Model LLM per Sub-Agent */}
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                          Mô hình LLM riêng:
                        </Typography>
                        <Autocomplete
                          disabled={!isEditing}
                          freeSolo
                          options={MODEL_OPTIONS}
                          value={agent.model}
                          onChange={(_, newValue) => {
                            if (newValue) updateSubAgent(agent.id, 'model', newValue);
                          }}
                          onInputChange={(_, newInputValue) => {
                            updateSubAgent(agent.id, 'model', newInputValue);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              size="small"
                              placeholder="Chọn hoặc gõ tên mô hình..."
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.825rem' } }}
                            />
                          )}
                        />
                      </Box>

                      {/* API Key per Sub-Agent */}
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                          API Key riêng (Để trống để dùng API Key chung ở mục 2):
                        </Typography>
                        <TextField
                          disabled={!isEditing}
                          fullWidth
                          size="small"
                          type="password"
                          value={agent.apiKey}
                          onChange={(e) => updateSubAgent(agent.id, 'apiKey', e.target.value)}
                          placeholder="Nhập API Key riêng cho Sub-Agent..."
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Key className="w-3.5 h-3.5 text-slate-400" />
                              </InputAdornment>
                            ),
                          }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.825rem' } }}
                        />
                      </Box>

                      {/* Knowledge Base per Sub-Agent */}
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                          Tập tri thức chính (Knowledge Base):
                        </Typography>
                        <TextField
                          disabled={!isEditing}
                          fullWidth
                          size="small"
                          value={agent.kb}
                          onChange={(e) => updateSubAgent(agent.id, 'kb', e.target.value)}
                          placeholder="Tên file tri thức..."
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.825rem' } }}
                        />
                      </Box>

                      {/* Sub-Agent System Prompt */}
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                          Chỉ thị Prompt riêng:
                        </Typography>
                        <TextField
                          disabled={!isEditing}
                          fullWidth
                          multiline
                          rows={2}
                          size="small"
                          value={agent.prompt}
                          onChange={(e) => updateSubAgent(agent.id, 'prompt', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.825rem' } }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3.5 }} />

        {/* Section 4: Confidence Fallback Threshold */}
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle1" fontWeight={800} color="slate.900">
              4. Ngưỡng tự tin Fallback (Confidence Threshold)
            </Typography>
            <span className="px-3 py-1 text-xs font-black text-[#2563eb] bg-[#eff6ff] rounded-full">
              {(confidenceThreshold * 100).toFixed(0)}% Similarity Match
            </span>
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Nếu độ tương đồng Cosine score giữa câu hỏi sinh viên và tài liệu dưới mức này, Agent sẽ tự động chuyển câu hỏi về hàng chờ kiểm duyệt của Ban cố vấn.
          </Typography>
          <Box px={1}>
            <Slider
              value={confidenceThreshold}
              min={0.5}
              max={0.95}
              step={0.05}
              onChange={(_, val) => setConfidenceThreshold(val as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${(v * 100).toFixed(0)}%`}
              sx={{ color: '#2563eb' }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 3.5 }} />

        {/* Section 5: Temperature & Guardrails */}
        <Box mb={4}>
          <Typography variant="subtitle1" fontWeight={800} color="slate.900" mb={1}>
            5. Tham số Sinh từ & Giới hạn Phạm vi
          </Typography>

          <Box display="flex" flexDirection="column" gap={3} mt={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box maxWidth={500}>
                <Typography variant="body2" fontWeight={700} color="slate.900">
                  Nhiệt độ Temperature: <strong className="text-[#2563eb]">{temperature}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Mức độ sáng tạo từ vựng (0.0 = Chuẩn xác tuyệt đối theo văn bản, 1.0 = Mở rộng ngôn từ tự nhiên).
                </Typography>
              </Box>
              <Box width={220}>
                <Slider
                  value={temperature}
                  min={0.0}
                  max={0.7}
                  step={0.1}
                  onChange={(_, val) => setTemperature(val as number)}
                  sx={{ color: '#2563eb' }}
                />
              </Box>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={strictScope}
                  onChange={(e) => setStrictScope(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={700} color="slate.900">
                    Bật chế độ Giới hạn Phạm vi Nghiêm ngặt (Strict RAG Guardrail)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Chỉ cho phép Agent trả lời thông tin có trong văn bản tri thức đã duyệt. Tuyệt đối loại bỏ ảo giác (Hallucination).
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Box>

        {/* Actions Footer */}
        <Box display="flex" justifyContent="flex-end" pt={2.5} borderTop="1px solid #e2e8f0">
          <Button
            variant="contained"
            startIcon={<Save className="w-4 h-4" />}
            onClick={handleSave}
            sx={{
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              fontWeight: 700,
              px: 4,
              py: 1.2,
              textTransform: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Lưu tất cả cấu hình
          </Button>
        </Box>
      </Box>
    </Box>
  );
}




