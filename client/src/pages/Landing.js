import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
} from '@mui/material';

// Simple fade/slide variants for sections
const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function Landing() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  // Parallax bg for hero
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.9, 0.8]);

  const goOnboarding = () => navigate('/bootstrap');
  const goTryFree = () => navigate('/bootstrap');

  return (
    <Box sx={{ bgcolor: theme.palette.background.default }}>
      {/* Hero */}
      <Box component={motion.section} initial="hidden" animate="show" variants={staggerContainer}
        sx={{ pt: 8, pb: 10, position: 'relative', overflow: 'hidden' }}>
        <motion.div style={{ y, opacity }}>
          <Box sx={{
            position: 'absolute',
            top: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'secondary.light',
            filter: 'blur(60px)',
            opacity: 0.35,
          }} />
        </motion.div>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Stack spacing={3} component={motion.div} variants={fadeIn}>
                <Chip color="primary" label="Character ERP Cloud" sx={{ alignSelf: 'flex-start' }} />
                <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight={700}>
                  Управляйте студией детейлинга, мойки и оклейки в облаке
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  Минималистичный интерфейс, живые отчёты, магазин и зарплаты в одном месте.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button size="large" variant="contained" color="primary" onClick={goTryFree}>
                    Попробовать бесплатно
                  </Button>
                  <Button size="large" variant="outlined" color="primary" onClick={goOnboarding}>
                    Начать бесплатно
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box component={motion.div} variants={fadeIn}
                sx={{
                  borderRadius: theme.shape.borderRadius,
                  overflow: 'hidden',
                  boxShadow: 'var(--mui-shadow-2)',
                  border: `1px solid ${theme.palette.divider}`,
                }}>
                {/* Placeholder media: screenshots/video */}
                <Box sx={{ position: 'relative', pt: '56.25%', bgcolor: theme.palette.background.paper }}>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <Typography variant="subtitle1" color="text.secondary">
                      Видео и скриншоты продукта (демо)
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Для кого */}
      <Box component={motion.section} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography component={motion.h2} variants={fadeIn} variant="h4" fontWeight={700} sx={{ mb: 4 }}>
            Для кого
          </Typography>
          <Grid container spacing={3}>
            {[{
              title: 'Детейлинг',
              desc: 'Заказы, статусы, фотографии работ, консультации клиентов.',
              emoji: '✨',
            }, {
              title: 'Автомойка',
              desc: 'Смены, касса, склад химии, простая отчётность.',
              emoji: '🚿',
            }, {
              title: 'Студия оклейки',
              desc: 'Материалы, карты раскроя, финансы и аналитика.',
              emoji: '🎯',
            }].map((p) => (
              <Grid key={p.title} item xs={12} md={4}>
                <Card component={motion.div} variants={fadeIn}>
                  <CardHeader avatar={<Avatar>{p.emoji}</Avatar>} title={p.title} />
                  <CardContent>
                    <Typography color="text.secondary">{p.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Возможности */}
      <Box component={motion.section} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} sx={{ py: 8, bgcolor: theme.palette.background.paper }}>
        <Container maxWidth="lg">
          <Typography component={motion.h2} variants={fadeIn} variant="h4" fontWeight={700} sx={{ mb: 4 }}>
            Возможности
          </Typography>
          <Grid container spacing={3}>
            {[
              { title: 'Живые отчёты', desc: 'Прибыль, зарплаты, кассовые операции, обороты склада.' },
              { title: 'Магазин', desc: 'Продажи, возвраты, товары и учёт оплаты.' },
              { title: 'Онбординг', desc: 'Быстрый старт и загрузка демо‑данных.' },
              { title: 'RBAC', desc: 'Роли и права для сотрудников.' },
              { title: 'Шаблоны документов', desc: 'Счета, акты, договоры, печать и PDF.' },
              { title: 'Календарь', desc: 'Расписание, занятость боксов, записи клиентов.' },
            ].map((f) => (
              <Grid key={f.title} item xs={12} sm={6} md={4}>
                <Card component={motion.div} variants={fadeIn}>
                  <CardHeader title={f.title} />
                  <CardContent>
                    <Typography color="text.secondary">{f.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Тарифы */}
      <Box component={motion.section} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography component={motion.h2} variants={fadeIn} variant="h4" fontWeight={700} sx={{ mb: 4 }}>
            Тарифы
          </Typography>
          <Grid container spacing={3}>
            {[{
              name: 'Старт', price: '0 ₽', features: ['Демо‑данные', 'Онбординг', '1 студия']
            }, {
              name: 'Про', price: '1 990 ₽/мес', features: ['Отчёты', 'Склад + Магазин', 'RBAC', '3 студии']
            }, {
              name: 'Бизнес', price: '4 990 ₽/мес', features: ['Все модули', 'Документы', '5+ студий']
            }].map((plan) => (
              <Grid key={plan.name} item xs={12} md={4}>
                <Card component={motion.div} variants={fadeIn}>
                  <CardHeader title={plan.name} subheader={plan.price} />
                  <CardContent>
                    <Stack spacing={1}>
                      {plan.features.map((it) => (
                        <Stack key={it} direction="row" spacing={1} alignItems="center">
                          <Chip size="small" color="success" label="" />
                          <Typography variant="body2">{it}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button fullWidth variant="contained" onClick={goTryFree}>Выбрать</Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Отзывы и партнёры */}
      <Box component={motion.section} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} sx={{ py: 8, bgcolor: theme.palette.background.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={6}>
            <Grid item xs={12} md={6}>
              <Typography component={motion.h3} variants={fadeIn} variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                Отзывы
              </Typography>
              <Stack spacing={2}>
                {["Лучший ERP для детейлинга — всё прозрачно.", "Запустились за день и начали считать зарплаты.", "Магазин и склад — супер удобно."].map((q, idx) => (
                  <Card key={idx} component={motion.div} variants={fadeIn}>
                    <CardContent>
                      <Typography>“{q}”</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography component={motion.h3} variants={fadeIn} variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                Подключённые студии
              </Typography>
              <Stack direction="row" gap={2} flexWrap="wrap">
                {[1,2,3,4,5,6,7,8].map((i) => (
                  <Avatar key={i} variant="rounded" sx={{ width: 72, height: 72 }}>
                    C{i}
                  </Avatar>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA bottom */}
      <Box component={motion.section} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} sx={{ py: 10 }}>
        <Container maxWidth="md">
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography component={motion.h2} variants={fadeIn} variant="h4" fontWeight={700}>
              Готовы попробовать?
            </Typography>
            <Typography component={motion.p} variants={fadeIn} color="text.secondary">
              Начните бесплатно — загрузим демо‑данные и покажем ключевые модули.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button size="large" variant="contained" onClick={goTryFree}>Попробовать бесплатно</Button>
              <Button size="large" variant="outlined" onClick={goOnboarding}>Начать бесплатно</Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}