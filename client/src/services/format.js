const currencyFormatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });
const numberFormatter = new Intl.NumberFormat('ru-RU');

export const formatCurrencyRu = (value) => currencyFormatter.format(Number(value || 0));
export const formatNumberRu = (value) => numberFormatter.format(Number(value || 0));