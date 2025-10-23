import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Stack, Paper, Typography, Button, IconButton, Divider, Chip, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsBackBar from '../../components/SettingsBackBar';
import { Editor } from '@tinymce/tinymce-react';

const DOCS_KEY = 'settings_documents';
const DOC_TEMPLATES_KEY = 'document_templates';
const DOC_META_KEY = 'document_meta';
const DOC_VERSIONS_KEY = 'document_versions';

const DEFAULT_HTML = '<p></p>';

const VARIABLES = {
  Изображения: [
    { key: 'logo', label: 'Логотип' },
    { key: 'qr', label: 'QR' },
  ],
  Компания: [
    { key: 'companyName', label: 'Название компании' },
    { key: 'locationName', label: 'Название локации' },
    { key: 'locationAddress', label: 'Адрес локации' },
    { key: 'locationPhone', label: 'Телефон локации' },
  ],
  Заказ: [
    { key: 'id', label: 'Номер заказа' },
    { key: 'status', label: 'Статус' },
    { key: 'types', label: 'Типы' },
    { key: 'startDate', label: 'Дата создания' },
    { key: 'endDate', label: 'План завершения' },
    { key: 'itemsHtml', label: 'Товары и услуги (таблица)' },
    { key: 'paymentsHtml', label: 'Платежи (таблица)' },
    { key: 'amount', label: 'Сумма (после скидок без налога)' },
    { key: 'paid', label: 'Оплачено' },
    { key: 'profit', label: 'Прибыль' },
  ],
  Клиент: [
    { key: 'client', label: 'Имя клиента' },
    { key: 'clientPhone', label: 'Телефон клиента' },
  ],
  Финансы: [
    { key: 'receipt', label: 'Квитанция/основание' },
    { key: 'currency', label: 'Валюта' },
  ],
  Сотрудники: [
    { key: 'employee', label: 'Менеджер/исполнитель' },
  ],
  Платёж: [
    { key: 'typeLabel', label: 'Тип операции (Приход/Расход)' },
    { key: 'date', label: 'Дата платежа' },
    { key: 'amount', label: 'Сумма платежа' },
    { key: 'method', label: 'Метод оплаты' },
    { key: 'article', label: 'Статья' },
    { key: 'basis', label: 'Основание' },
    { key: 'description', label: 'Описание' },
    { key: 'employee', label: 'Сотрудник' },
    { key: 'client', label: 'Клиент (если указан)' },
    { key: 'orderId', label: 'Заказ (если указан)' },
  ],
  Скидки: [
    { key: 'amountWithoutDiscount', label: 'Сумма без скидки' },
    { key: 'discountTotal', label: 'Скидка всего' },
    { key: 'amountWithDiscount', label: 'Сумма со скидкой (без налога)' },
    { key: 'taxPercent', label: 'Налог, %' },
    { key: 'taxAmount', label: 'Сумма налога' },
    { key: 'grandTotal', label: 'Итого (со скидкой и налогом)' },
  ],
  Товар: [
    { key: 'productName', label: 'Название товара' },
    { key: 'sku', label: 'Артикул' },
    { key: 'price', label: 'Цена' },
    { key: 'barcodeHtml', label: 'Штрихкод/QR (HTML)' },
  ],
  Дата: [
    { key: 'date', label: 'Текущая дата' },
    { key: 'printTime', label: 'Время печати' },
  ],
  Дополнительно: [
    { key: 'freeText', label: 'Произвольный текст' },
  ],
};

const PRESETS = [
  {
    name: 'Ценник 58×40 мм (термо)',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>Ценник 58x40</title><style>@page { size: 58mm 40mm; margin: 3mm; } body { width: 52mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .name { font-size: 14px; font-weight: 700; } .price { font-size: 18px; font-weight: 800; margin-top: 4px; } .sku { font-size: 12px; opacity: 0.8; } .barcode { margin-top: 6px; }</style></head><body><div class="name">{{productName}}</div><div class="sku">Артикул: {{sku}}</div><div class="price">{{price}}</div><div class="barcode">{{barcodeHtml}}</div></body></html>`
  },
  {
    name: 'Этикетка 50×30 мм (термо)',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>Этикетка 50x30</title><style>@page { size: 50mm 30mm; margin: 2mm; } body { width: 46mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .row { display:flex; justify-content:space-between; } .name { font-size: 12px; font-weight: 600; } .price { font-size: 16px; font-weight: 800; } .sku { font-size: 11px; opacity: 0.8; }</style></head><body><div class="name">{{productName}}</div><div class="row"><div class="sku">SKU: {{sku}}</div><div class="price">{{price}}</div></div><div>{{qr}}</div></body></html>`
  },
  {
    name: 'Ценник A4 (3 колонки)',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>Ценник A4</title><style>@page { size: A4; margin: 10mm; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; } .card { border: 1px dashed #888; padding: 6mm; } .name { font-size: 14px; font-weight: 700; } .price { font-size: 18px; font-weight: 800; margin-top: 2mm; }</style></head><body><div class="grid"><div class="card"><div class="name">{{productName}}</div><div class="price">{{price}}</div></div><div class="card"><div class="name">{{productName}}</div><div class="price">{{price}}</div></div><div class="card"><div class="name">{{productName}}</div><div class="price">{{price}}</div></div></div></body></html>`
  },
  {
    name: 'Zebra GK420d (EPL) — 58×40 мм',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>Zebra GK420d 58x40</title><style>@page { size: 58mm 40mm; margin: 4mm 2mm 2mm 3mm; } body { width: 52mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .name { font-size: 13px; font-weight: 700; } .price { font-size: 18px; font-weight: 800; } .row { display:flex; justify-content:space-between; align-items:flex-end; } .barcode { margin-top: 4px; }</style></head><body><div class="name">{{productName}}</div><div class="row"><div>SKU: {{sku}}</div><div class="price">{{price}}</div></div><div class="barcode">{{barcodeHtml}}</div></body></html>`
  },
  {
    name: 'TSPL/EPL — 50×30 мм (смещённый левый край)',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>TSPL 50x30</title><style>@page { size: 50mm 30mm; margin: 2mm 2mm 2mm 3mm; } body { width: 45mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .row { display:flex; justify-content:space-between; } .name { font-size: 12px; font-weight: 600; } .price { font-size: 16px; font-weight: 800; } .sku { font-size: 11px; opacity: 0.8; }</style></head><body><div class="name">{{productName}}</div><div class="row"><div class="sku">Артикул: {{sku}}</div><div class="price">{{price}}</div></div><div class="barcode">{{barcodeHtml}}</div></body></html>`
  },
  {
    name: 'Чек 58 мм (термо, узкая лента)',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>Чек 58мм</title><style>@page { size: 58mm; margin: 3mm 3mm 3mm 4mm; } body { width: 51mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .hdr { text-align:center; font-weight:700; } .small { font-size: 11px; } .total { margin-top: 6px; font-size: 14px; font-weight: 800; } .line { border-top: 1px dashed #999; margin: 4px 0; }</style></head><body><div class="hdr">{{companyName}}</div><div class="small">{{date}} {{printTime}}</div><div class="line"></div><div>{{itemsHtml}}</div><div class="line"></div><div>Скидка: {{discountTotal}}</div><div>Налог: {{taxAmount}}</div><div class="total">Итого: {{grandTotal}}</div><div>Оплачено: {{paid}}</div></body></html>`
  },
  {
    name: 'Чек 80 мм (термо, широкая лента)',
    html: `<!doctype html><html><head><meta charset="utf-8" /><title>Чек 80мм</title><style>@page { size: 80mm; margin: 3mm 3mm 3mm 4mm; } body { width: 73mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; } .hdr { text-align:center; font-weight:700; } .small { font-size: 11px; } .total { margin-top: 6px; font-size: 14px; font-weight: 800; } .line { border-top: 1px dashed #999; margin: 4px 0; }</style></head><body><div class="hdr">{{companyName}}</div><div class="small">{{date}} {{printTime}}</div><div class="line"></div><div>{{itemsHtml}}</div><div class="line"></div><div>Скидка: {{discountTotal}}</div><div>Налог: {{taxAmount}}</div><div class="total">Итого: {{grandTotal}}</div><div>Оплачено: {{paid}}</div></body></html>`
  }
];

function HelpBlock() {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <HelpOutlineIcon sx={{ color: 'text.secondary' }} />
        <Typography variant="h6">Справка</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Редактируйте шаблон и сохраняйте изменения, чтобы использовать документ при печати.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Документ не отображается в списке печати</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Перейдите в «Настройки → Типы заказа» и привяжите документ к нужному типу заказа. У каждого типа — свой набор документов.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Как уменьшить QR-код?</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Поместите переменную QR в ячейку таблицы и измените ширину/высоту ячейки — размер QR зависит от размеров ячейки.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Текст накладывается</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Увеличьте ширину столбцов/высоту строк, уменьшите шрифт, сократите или разбейте длинный текст.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Логотип</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Загрузите логотип в блоке «Изображения» и перетащите переменную в нужную ячейку. Настройте размер ячейки — сохраняйте пропорции.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Колонтитулы браузера</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        В Chrome отключите «Верхние и нижние колонтитулы» в дополнительных настройках печати. Это элементы браузера.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Квитанции и ценники</Typography>
      <Typography variant="body2">
        Используйте переменные из панели справа и готовые таблицы (товары/услуги). Печать возможна на термопринтере и обычном принтере.
      </Typography>
    </Paper>
  );
}

export default function DocumentEditorPage() {
  const { name: rawName } = useParams();
  const name = decodeURIComponent(rawName || '');
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const [value, setValue] = useState('');
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOC_TEMPLATES_KEY);
      const obj = JSON.parse(raw || '{}');
      const html = obj?.[name] || DEFAULT_HTML;
      setValue(html);
    } catch {
      setValue(DEFAULT_HTML);
    }
  }, [name]);

  useEffect(() => {
    try {
      const rawV = localStorage.getItem(DOC_VERSIONS_KEY);
      const objV = JSON.parse(rawV || '{}');
      setVersions(objV?.[name] || []);
    } catch {
      setVersions([]);
    }
  }, [name]);

  const applyPreset = (html) => {
    if (editorRef.current) {
      editorRef.current.setContent(html);
    } else {
      setValue(html);
    }
  };

  const restoreVersion = (idx) => {
    const v = versions[idx];
    if (!v) return;
    applyPreset(v.html);
  };

  const onSave = () => {
    try {
      const raw = localStorage.getItem(DOC_TEMPLATES_KEY);
      const obj = JSON.parse(raw || '{}');
      const html = editorRef.current ? editorRef.current.getContent() : value;
      const next = { ...obj, [name]: html };
      localStorage.setItem(DOC_TEMPLATES_KEY, JSON.stringify(next));
      // ensure document exists in list for backward compatibility
      const rawDocs = localStorage.getItem(DOCS_KEY);
      const docs = JSON.parse(rawDocs || '[]');
      if (Array.isArray(docs)) {
        if (!docs.includes(name)) {
          const updated = [...docs, name];
          localStorage.setItem(DOCS_KEY, JSON.stringify(updated));
        }
      }
      // save version
      const rawV = localStorage.getItem(DOC_VERSIONS_KEY);
      const objV = JSON.parse(rawV || '{}');
      const list = [{ ts: new Date().toISOString(), html }, ...(objV[name] || [])].slice(0, 20);
      objV[name] = list;
      localStorage.setItem(DOC_VERSIONS_KEY, JSON.stringify(objV));
      setVersions(list);
    } catch {}
    navigate('/settings/documents');
  };

  const onDeleteTemplate = () => {
    try {
      const raw = localStorage.getItem(DOC_TEMPLATES_KEY);
      const obj = JSON.parse(raw || '{}');
      if (obj && obj[name]) {
        delete obj[name];
        localStorage.setItem(DOC_TEMPLATES_KEY, JSON.stringify(obj));
      }
    } catch {}
    navigate('/settings/documents');
  };

  const insertVar = (key) => {
    const token = `{{${key}}}`;
    if (editorRef.current) {
      editorRef.current.insertContent(token);
    } else {
      setValue((prev) => prev + token);
    }
  };

  return (
    <Box>
      <SettingsBackBar title={name} subtitle="Редактор документа" />

      <Stack direction="row" spacing={1} sx={{ mb: 2, justifyContent: 'flex-end' }}>
        <Tooltip title="Удалить шаблон">
          <IconButton onClick={onDeleteTemplate}><DeleteOutlineIcon /></IconButton>
        </Tooltip>
        <Tooltip title="Справка">
          <IconButton onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}><HelpOutlineIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" onClick={onSave}>Сохранить</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
        <Editor
          tinymceScriptSrc="https://cdn.tiny.cloud/1/no-api-key/tinymce/6/tinymce.min.js"
          onInit={(evt, editor) => (editorRef.current = editor)}
          value={value}
          onEditorChange={(content) => setValue(content)}
          init={{
            height: 580,
            menubar: true,
            plugins: [
              'advlist autolink lists link image charmap print preview anchor',
              'searchreplace visualblocks code fullscreen',
              'insertdatetime media table paste code help wordcount'
            ],
            toolbar:
              'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | removeformat | help',
            content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px }'
          }}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Переменные</Typography>
        {Object.keys(VARIABLES).map((group) => (
          <Box key={group} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{group}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {VARIABLES[group].map((v) => (
                <Chip key={v.key} label={v.label} color="primary" variant="outlined" onClick={() => insertVar(v.key)} />
              ))}
            </Stack>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Вставка по клику: переменная добавится в позицию курсора в редакторе.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Пресеты ценников и этикеток</Typography>
        <Stack spacing={1}>
          {PRESETS.map((p) => (
            <Stack key={p.name} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ flex: 1 }}>{p.name}</Typography>
              <Button size="small" variant="outlined" onClick={() => applyPreset(p.html)}>Заменить содержимое</Button>
            </Stack>
          ))}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
          Пресеты используют размеры в мм. Фактическая печать зависит от настроек браузера и принтера.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>История версий</Typography>
        {versions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Пока нет сохранённых версий</Typography>
        ) : (
          <Stack spacing={1}>
            {versions.map((v, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="center">
                <Typography sx={{ flex: 1 }}>{new Date(v.ts).toLocaleString('ru-RU')}</Typography>
                <Button size="small" variant="outlined" onClick={() => restoreVersion(idx)}>Откатить</Button>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      <HelpBlock />
    </Box>
  );
}