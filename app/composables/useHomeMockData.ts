import { createSharedComposable } from '@vueuse/core'
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'
import type { Period, Range, Sale, Stat } from '~/types'
import { randomInt, randomFrom } from '~/utils'

export type ChartDataRecord = {
  date: Date
  amount: number
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

const sampleEmails = [
  'james.anderson@example.com',
  'mia.white@example.com',
  'william.brown@example.com',
  'emma.davis@example.com',
  'ethan.harris@example.com'
]

const baseStats = [{
  title: 'Customers',
  icon: 'i-lucide-users',
  minValue: 400,
  maxValue: 1000,
  minVariation: -15,
  maxVariation: 25
}, {
  title: 'Conversions',
  icon: 'i-lucide-chart-pie',
  minValue: 1000,
  maxValue: 2000,
  minVariation: -10,
  maxVariation: 20
}, {
  title: 'Revenue',
  icon: 'i-lucide-circle-dollar-sign',
  minValue: 200000,
  maxValue: 500000,
  minVariation: -20,
  maxVariation: 30,
  formatter: formatCurrency
}, {
  title: 'Orders',
  icon: 'i-lucide-shopping-cart',
  minValue: 100,
  maxValue: 300,
  minVariation: -5,
  maxVariation: 15
}]

const _useHomeMockData = () => {
  const sales = ref<Sale[]>([])
  const stats = ref<Stat[]>([])
  const chartData = ref<ChartDataRecord[]>([])

  function generateSales(): Sale[] {
    const result: Sale[] = []
    const currentDate = new Date()

    for (let i = 0; i < 5; i++) {
      const hoursAgo = randomInt(0, 48)
      const date = new Date(currentDate.getTime() - hoursAgo * 3600000)

      result.push({
        id: (4600 - i).toString(),
        date: date.toISOString(),
        status: randomFrom(['paid', 'failed', 'refunded']),
        email: randomFrom(sampleEmails),
        amount: randomInt(100, 1000)
      })
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  function generateStats(): Stat[] {
    return baseStats.map((stat) => {
      const value = randomInt(stat.minValue, stat.maxValue)
      const variation = randomInt(stat.minVariation, stat.maxVariation)

      return {
        title: stat.title,
        icon: stat.icon,
        value: stat.formatter ? stat.formatter(value) : value,
        variation
      }
    })
  }

  function generateChartData(period: Period, range: Range): ChartDataRecord[] {
    const dates = ({
      daily: eachDayOfInterval,
      weekly: eachWeekOfInterval,
      monthly: eachMonthOfInterval
    } as Record<Period, typeof eachDayOfInterval>)[period](range)

    const min = 1000
    const max = 10000

    return dates.map(date => ({ date, amount: Math.floor(Math.random() * (max - min + 1)) + min }))
  }

  function regenerate(period: Period, range: Range) {
    sales.value = generateSales()
    stats.value = generateStats()
    chartData.value = generateChartData(period, range)
  }

  return { sales, stats, chartData, regenerate }
}

export const useHomeMockData = createSharedComposable(_useHomeMockData)
