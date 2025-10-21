import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import OrderTypesSettingsPage from './pages/settings/OrderTypes';
import PaymentArticlesPage from './pages/settings/PaymentArticles';
import OrderStatusesSettingsPage from './pages/settings/OrderStatuses';

// Layout components
import Layout from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import DetailingOrders from './pages/DetailingOrders';
import Orders from './pages/Orders';
import Calendar from './pages/Calendar';
import NotFound from './pages/NotFound';
// удалён: раздел «Тренды» объединён в «Дашборд»
import Services from './pages/Services';
import InventoryProducts from './pages/inventory/Products';
import InventoryOrders from './pages/inventory/Orders';
import InventorySuppliers from './pages/inventory/Suppliers';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import ListSettingsPage from './pages/settings/ListSettingsPage';
import Company from './pages/settings/Company';
import Employees from './pages/settings/Employees';
import OrdersGeneral from './pages/settings/OrdersGeneral';
import OrdersSMS from './pages/settings/OrdersSMS';
import ClientsNotifications from './pages/settings/ClientsNotifications';
import FieldsBuilderPage from './pages/settings/FieldsBuilderPage';
import DocumentsSettingsPage from './pages/settings/Documents';
import DocumentEditorPage from './pages/settings/DocumentEditor';
import TasksBoard from './pages/TasksBoard';
import TasksList from './pages/TasksList';
import TaskDetails from './pages/TaskDetails';
import Login from './pages/Login';
import UsersSettingsPage from './pages/settings/Users';
import RolesSettingsPage from './pages/settings/Roles';
import BootstrapWizard from './pages/BootstrapWizard';
import BootstrapFirst from './pages/BootstrapFirst';
import RbacTest from './pages/RbacTest';
import UiThemePage from './pages/settings/UiTheme';
// Тема импортируется из отдельного файла theme.js

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/bootstrap" element={<BootstrapWizard />} />
          <Route path="/bootstrap-first" element={<BootstrapFirst />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            {/* удалён: маршрут «/trends» объединён в «Дашборд» */}
            <Route path="tasks" element={<TasksBoard />} />
            <Route path="tasks/list" element={<TasksList />} />
            <Route path="tasks/:id" element={<TaskDetails />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:type" element={<Orders />} />
            <Route path="payments" element={<ProtectedRoute roles={["Admin","Finance"]}><Payments /></ProtectedRoute>} />
            <Route path="clients" element={<Clients />} />
            <Route path="marketing" element={<ProtectedRoute roles={["Admin","Manager"]}><div><h2>Маркетинг</h2><p>Страница в разработке</p></div></ProtectedRoute>} />
            <Route path="services" element={<ProtectedRoute roles={["Admin","Manager","Detailing"]}><Services /></ProtectedRoute>} />
            <Route path="production" element={<ProtectedRoute roles={["Admin","Production"]}><div><h2>Производство</h2><p>Страница в разработке</p></div></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute roles={["Admin","Production"]}><div><h2>Склад</h2><p>Выберите подпункт слева</p></div></ProtectedRoute>} />
            <Route path="inventory/products" element={<ProtectedRoute roles={["Admin","Production"]}><InventoryProducts /></ProtectedRoute>} />
            <Route path="inventory/orders" element={<ProtectedRoute roles={["Admin","Production"]}><InventoryOrders /></ProtectedRoute>} />
            <Route path="inventory/suppliers" element={<ProtectedRoute roles={["Admin","Production"]}><InventorySuppliers /></ProtectedRoute>} />
            <Route path="shop" element={<ProtectedRoute roles={["Admin","Manager"]}><div><h2>Магазин</h2><p>Страница в разработке</p></div></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute roles={["Admin","Manager"]}><div><h2>Отчеты</h2><p>Страница в разработке</p></div></ProtectedRoute>} />
            <Route path="announcements" element={<ProtectedRoute roles={["Admin","Manager"]}><div><h2>Объявления</h2><p>Страница в разработке</p></div></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute roles={["Admin","Manager"]}><Settings /></ProtectedRoute>} />
            <Route path="settings/company" element={<ProtectedRoute roles={["Admin","Manager"]}><Company /></ProtectedRoute>} />
            <Route path="settings/employees" element={<ProtectedRoute roles={["Admin","Manager"]}><Employees /></ProtectedRoute>} />
            <Route path="settings/users" element={<ProtectedRoute roles={["Admin"]}><UsersSettingsPage /></ProtectedRoute>} />
            <Route path="settings/roles" element={<ProtectedRoute roles={["Admin"]}><RolesSettingsPage /></ProtectedRoute>} />
            <Route path="settings/documents" element={<ProtectedRoute roles={["Admin","Manager"]}><DocumentsSettingsPage /></ProtectedRoute>} />
            <Route path="settings/documents/:name" element={<ProtectedRoute roles={["Admin","Manager"]}><DocumentEditorPage /></ProtectedRoute>} />
            <Route path="settings/orders/general" element={<ProtectedRoute roles={["Admin","Manager"]}><OrdersGeneral /></ProtectedRoute>} />
            <Route path="settings/order-statuses" element={<ProtectedRoute roles={["Admin","settings.statuses:*","settings.statuses:list"]}><OrderStatusesSettingsPage /></ProtectedRoute>} />
            <Route path="settings/orders/sms" element={<ProtectedRoute roles={["Admin","Manager"]}><OrdersSMS /></ProtectedRoute>} />
            <Route path="settings/payments/articles" element={<ProtectedRoute roles={["Admin","Manager","Finance"]}><PaymentArticlesPage /></ProtectedRoute>} />
            <Route path="settings/payments/methods" element={<ProtectedRoute roles={["Admin","Manager","Finance"]}><ListSettingsPage title="Способы оплаты" storageKey="payment_methods" initialItems={["Наличные","Карта","Банковский перевод"]} /></ProtectedRoute>} />
            <Route path="settings/clients/notifications" element={<ProtectedRoute roles={["Admin","Manager"]}><ClientsNotifications /></ProtectedRoute>} />
            <Route path="settings/forms/order-types" element={<ProtectedRoute roles={["Admin"]}><OrderTypesSettingsPage /></ProtectedRoute>} />
            <Route path="settings/forms/order-fields" element={<ProtectedRoute roles={["Admin","Manager"]}><FieldsBuilderPage title="Поля заказа" storageKey="settings_order_fields" /></ProtectedRoute>} />
            <Route path="settings/forms/client-types" element={<ProtectedRoute roles={["Admin","Manager"]}><ListSettingsPage title="Типы клиентов" storageKey="settings_client_types" initialItems={["VIP","Постоянный","Новый"]} /></ProtectedRoute>} />
            <Route path="settings/forms/client-fields" element={<ProtectedRoute roles={["Admin","Manager"]}><FieldsBuilderPage title="Поля клиента" storageKey="settings_client_fields" /></ProtectedRoute>} />
            <Route path="settings/forms/directories" element={<ProtectedRoute roles={["Admin","Manager"]}><ListSettingsPage title="Справочники" storageKey="settings_directories" initialItems={["Единицы измерения","Марки авто","Модели авто"]} /></ProtectedRoute>} />
            <Route path="settings/ui-theme" element={<ProtectedRoute roles={["Admin","Manager"]}><UiThemePage /></ProtectedRoute>} />
            <Route path="knowledge" element={<div><h2>База знаний</h2><p>Страница в разработке</p></div>} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="rbac-test" element={<ProtectedRoute><RbacTest /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;