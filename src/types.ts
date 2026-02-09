export type ItemKind = 'schedule' | 'exam' | 'holiday'

export type ScheduleEventType = 'meeting' | 'trip' | 'holiday'

export type ISODate = `${number}-${number}-${number}`
export type ISOTime = `${number}:${number}`

export type Id = string

export type BaseItem = {
  id: Id
  date: ISODate
  title: string
  notes?: string
  group?: string
  location?: string
}

export type TimeRange = {
  startTime?: ISOTime
  endTime?: ISOTime
}

export type ScheduleItem = BaseItem &
  TimeRange & {
    kind: 'schedule'
    type: Exclude<ScheduleEventType, 'holiday'>
    description?: string
  }

export type ExamItem = BaseItem &
  TimeRange & {
    kind: 'exam'
    subject: string
    className?: string
  }

export type HolidayItem = BaseItem & {
  kind: 'holiday'
  reason: string
}

export type AnyItem = ScheduleItem | ExamItem | HolidayItem

export type ScheduleData = {
  version: 1
  schedule: ScheduleItem[]
  exams: ExamItem[]
  holidays: HolidayItem[]
}
