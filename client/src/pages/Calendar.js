import React, { useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ru from 'date-fns/locale/ru';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'ru': ru,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Мок-данные для календаря
const events = [
  {
    title: 'Полировка BMW X5',
    start: new Date(2023, 5, 18, 10, 0),
    end: new Date(2023, 5, 18, 14, 0),
    resource: 'Бокс 1',
  },
  {
    title: 'Химчистка Mercedes GLE',
    start: new Date(2023, 5, 19, 12, 0),
    end: new Date(2023, 5, 19, 16, 0),
    resource: 'Бокс 2',
  },
  {
    title: 'Керамика Audi Q7',
    start: new Date(2023, 5, 20, 9, 0),
    end: new Date(2023, 5, 20, 13, 0),
    resource: 'Бокс 1',
  },
];

const Calendar = () => {
  const [myEvents, setMyEvents] = useState(events);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
        Календарь бронирования
      </Typography>
      <Paper sx={{ p: 2, height: 'calc(100vh - 180px)' }}>
        <BigCalendar
          localizer={localizer}
          events={myEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={['month', 'week', 'day', 'agenda']}
          messages={{
            next: "Вперед",
            previous: "Назад",
            today: "Сегодня",
            month: "Месяц",
            week: "Неделя",
            day: "День",
            agenda: "Список"
          }}
          resourceIdAccessor="resource"
          resources={[
            { id: 'Бокс 1', title: 'Бокс 1' },
            { id: 'Бокс 2', title: 'Бокс 2' },
            { id: 'Бокс 3', title: 'Бокс 3' },
          ]}
        />
      </Paper>
    </Box>
  );
};

export default Calendar;