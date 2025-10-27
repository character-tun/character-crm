import React from 'react';
import {
  Dashboard, CalendarMonth, ShoppingCart, BuildCircle, CarRepair, Handyman, Science,
  CreditCard, AddCircle, RemoveCircle, Assessment, BarChart, Group, Campaign,
  Insights, MarkEmailRead, DesignServices, Inventory2, Factory, History,
  Warehouse, SwapHoriz, Storefront, Description, PhotoLibrary, Equalizer, CampaignOutlined, Settings
} from '@mui/icons-material';

export type NavItem = {
  id: string;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  role?: string;            // опционально
  children?: NavItem[];
};

export const nav: NavItem[] = [
  {
    id: 'garage',
    label: 'Наш гараж',
    icon: React.createElement(Dashboard),
    path: '/',
    children: [
      { id: 'dashboard', label: 'Дашборд', icon: React.createElement(Dashboard), path: '/' },
      { id: 'calendar',  label: 'Календарь', icon: React.createElement(CalendarMonth), path: '/calendar' }
    ]
  },
  {
    id: 'orders',
    label: 'Заказы',
    icon: React.createElement(ShoppingCart),
    path: '/orders',
    children: [
      { id: 'orders-all',      label: 'Все заказы',       icon: React.createElement(ShoppingCart), path: '/orders' },
      { id: 'orders-parts',    label: 'Детали',           icon: React.createElement(BuildCircle),  path: '/orders/parts' },
      { id: 'orders-detailing',label: 'Детейлинг',        icon: React.createElement(CarRepair),    path: '/orders/detailing' },
      { id: 'orders-body',     label: 'Кузовной ремонт',  icon: React.createElement(Handyman),     path: '/orders/body' },
      { id: 'orders-chem',     label: 'Автохимия',        icon: React.createElement(Science),      path: '/inventory/products' }
    ]
  },
  {
    id: 'money',
    label: 'Деньги',
    icon: React.createElement(CreditCard),
    path: '/payments',
    role: 'Finance',
    children: [
      { id: 'income-add',  label: 'Добавить доход',  icon: React.createElement(AddCircle),   path: '/payments' },
      { id: 'expense-add', label: 'Добавить расход', icon: React.createElement(RemoveCircle), path: '/payments' },
      { id: 'cashflow',    label: 'ДДС',             icon: React.createElement(Assessment),   path: '/reports' },
      { id: 'summary',     label: 'Сводные отчеты',  icon: React.createElement(BarChart),     path: '/reports' }
    ]
  },
  {
    id: 'clients',
    label: 'Клиенты',
    icon: React.createElement(Group),
    path: '/clients',
    children: [
      { id: 'client-add',  label: 'Добавить',        icon: React.createElement(AddCircle), path: '/clients?modal=new' },
      { id: 'client-list', label: 'Список клиентов', icon: React.createElement(Group),     path: '/clients' }
    ]
  },
  {
    id: 'marketing',
    label: 'Маркетинг',
    icon: React.createElement(CampaignOutlined),
    path: '/marketing',
    children: [
      { id: 'anti-rain',       label: 'Продвижение антидождя', icon: React.createElement(Campaign),     path: '/marketing/anti-rain' },
      { id: 'mkt-analytics',   label: 'Аналитика продвижения', icon: React.createElement(Insights),     path: '/marketing/analytics' },
      { id: 'mailing',         label: 'Рассылки',              icon: React.createElement(MarkEmailRead),path: '/marketing/mailing' }
    ]
  },
  {
    id: 'services',
    label: 'Услуги',
    icon: React.createElement(DesignServices),
    path: '/services',
    children: [
      { id: 'services-list', label: 'Список услуг', icon: React.createElement(DesignServices), path: '/services' }
    ]
  },
  {
    id: 'products',
    label: 'Товары',
    icon: React.createElement(Inventory2),
    path: '/inventory/products',
    children: [
      { id: 'products-list', label: 'Список товаров', icon: React.createElement(Inventory2), path: '/inventory/products' }
    ]
  },
  {
    id: 'manufacturing',
    label: 'Производство',
    icon: React.createElement(Factory),
    path: '/production',
    children: [
      { id: 'mfg-orders',  label: 'Заказы на производство', icon: React.createElement(Factory), path: '/production/orders' },
      { id: 'mfg-history', label: 'История заказов',       icon: React.createElement(History), path: '/production/history' }
    ]
  },
  {
    id: 'warehouse',
    label: 'Склад',
    icon: React.createElement(Warehouse),
    path: '/inventory',
    children: [
      { id: 'wh-balance', label: 'Остатки',      icon: React.createElement(Warehouse), path: '/inventory/balance' },
      { id: 'wh-log',     label: 'Лог склада',   icon: React.createElement(History),   path: '/inventory/log' }
    ]
  },
  {
    id: 'shop',
    label: 'Магазин',
    icon: React.createElement(Storefront),
    path: '/shop',
    children: [
      { id: 'shop-sale',    label: 'Продажа',        icon: React.createElement(Storefront), path: '/shop' },
      { id: 'shop-history', label: 'История продаж', icon: React.createElement(History),    path: '/shop/history' },
    ]
  },
  {
    id: 'docs',
    label: 'Документы',
    icon: React.createElement(Description),
    path: '/settings/documents',
    children: [
      { id: 'docs-list', label: 'Список документов', icon: React.createElement(Description),  path: '/settings/documents' },
      { id: 'photobank', label: 'Фотобанк',          icon: React.createElement(PhotoLibrary), path: '/settings/documents/photobank' }
    ]
  },
  {
    id: 'reports',
    label: 'Отчёты',
    icon: React.createElement(Equalizer),
    path: '/reports',
    children: [
      { id: 'reports-payroll', label: 'Начисления', icon: React.createElement(Equalizer), path: '/reports/payroll' },
      { id: 'reports-stock', label: 'Оборот склада', icon: React.createElement(Equalizer), path: '/reports/stock-turnover' }
    ]
  },
  { id: 'pricing',   label: 'Тарифы',   icon: React.createElement(CreditCard), path: '/pricing' },
   { id: 'ads',        label: 'Объявления', icon: React.createElement(CampaignOutlined), path: '/marketing' },
   { id: 'settings',   label: 'Настройки',  icon: React.createElement(Settings), path: '/settings' },
];