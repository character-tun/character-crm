/**
 * ESLint rule: no-hardcoded-ui
 * Запрещает использование жёстких значений UI:
 *  - hex-цветов (#fff, #FFFFFF, #1a2b3c)
 *  - px-единиц (1px, 12px, 'px')
 * Исключения: файлы *.svg и JSX-разметка иконок (<svg>/<SvgIcon>/...Icon)
 */

'use strict';

/**
 * Проверяет строку на наличие hex и px
 */
function checkValue(context, node, value) {
  if (typeof value !== 'string' || !value) return;

  // Игнорируем var(--...)
  // (использование CSS-переменных провоцирует валидное обращение к токенам)
  const isCssVarOnly = /^var\(--[\w-]+\)$/.test(value.trim());
  if (isCssVarOnly) return;

  // hex: #RGB или #RRGGBB
  const hexRe = /(^|[^A-Za-z0-9_])#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})(?![A-Za-z0-9_])/;
  // px: 0px, 1px, 12px, а также отдельно стоящее 'px'
  const pxRe = /\b\d+px\b/;

  if (hexRe.test(value)) {
    context.report({
      node,
      messageId: 'avoidHex',
      data: { value },
    });
  }

  if (pxRe.test(value) || value.trim() === 'px') {
    context.report({
      node,
      messageId: 'avoidPx',
      data: { value },
    });
  }
}

function getJsxName(node) {
  if (!node || !node.openingElement) return '';
  const nameNode = node.openingElement.name;
  if (!nameNode) return '';
  if (nameNode.type === 'JSXIdentifier') return nameNode.name || '';
  if (nameNode.type === 'JSXMemberExpression') {
    // e.g., Mui.SvgIcon -> take right-most identifier
    let right = nameNode.property;
    return (right && right.name) || '';
  }
  return '';
}

function isInsideSvgJsx(node) {
  let p = node && node.parent;
  while (p) {
    if (p.type === 'JSXElement') {
      const n = getJsxName(p);
      if (n === 'svg' || n === 'SvgIcon' || /Icon$/.test(n)) return true;
    }
    p = p.parent;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Запрещает жёсткие UI-значения: hex-цвета и px-единицы',
      recommended: false,
    },
    schema: [],
    messages: {
      avoidHex: 'Запрещён хардкод цвета "{{value}}". Используйте theme.palette/var(--color-*)/токены.',
      avoidPx: 'Запрещено использовать px ("{{value}}"). Используйте rem/em/theme.spacing/токены.',
    },
  },

  create(context) {
    const filename = (context.getFilename && context.getFilename()) || '';

    // Исключаем svg-иконки целиком
    if (/\.svg$/i.test(filename)) {
      return {};
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          // Пропускаем строки внутри JSX-иконок
          if (isInsideSvgJsx(node)) return;
          checkValue(context, node, node.value);
        }
      },
      TemplateLiteral(node) {
        // Пропускаем разметку иконок
        if (isInsideSvgJsx(node)) return;
        // Проверяем статические части шаблона
        for (const q of node.quasis || []) {
          const cooked = (q.value && (q.value.cooked || q.value.raw)) || '';
          checkValue(context, node, cooked);
        }
      },
    };
  },
};