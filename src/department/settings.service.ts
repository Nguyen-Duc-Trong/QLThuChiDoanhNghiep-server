import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { handleServiceError } from '../common/handle-error.js';
import { Users } from '../users/entity/users.entity.js';
import { SystemSetting } from './entity/system-setting.entity.js';

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  IN_APP_EMAIL = 'IN_APP_EMAIL',
  IN_APP_EMAIL_SMS = 'IN_APP_EMAIL_SMS',
}

export const NOTIFICATION_CHANNEL_LABEL: Record<NotificationChannel, string> = {
  [NotificationChannel.IN_APP]: 'Chỉ trong ứng dụng',
  [NotificationChannel.IN_APP_EMAIL]: 'Email và ứng dụng',
  [NotificationChannel.IN_APP_EMAIL_SMS]: 'Email, ứng dụng và SMS',
};

/** Các key cấu hình hợp lệ + giá trị mặc định khi chưa lưu */
export const SYSTEM_SETTING_DEFAULTS = {
  currency: 'VND',
  // % ngân sách (đã chi + cam kết) / kế hoạch: từ ngưỡng này dòng ngân sách bị cảnh báo "Gần vượt"
  budgetWarningThreshold: 80,
  notificationChannel: NotificationChannel.IN_APP_EMAIL as NotificationChannel,
};

export type SystemSettings = typeof SYSTEM_SETTING_DEFAULTS;
type SettingKey = keyof SystemSettings;
const SETTING_KEYS = Object.keys(SYSTEM_SETTING_DEFAULTS) as SettingKey[];

/** Mẫu mã chứng từ: hiện cố định trong code (ExpensesService.nextCode), chỉ hiển thị cho admin xem */
export const DOCUMENT_CODE_PATTERNS = { expense: 'CHI-YYYYMM-XXXX' };

export type SettingsView = SystemSettings & {
  documentCodePatterns: typeof DOCUMENT_CODE_PATTERNS;
  notificationChannels: { value: NotificationChannel; label: string }[];
  updatedAt: Date | null;
  updatedByName: string | null;
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
  ) {}

  /** Giá trị cấu hình hiện hành (mặc định + đã lưu). Module khác dùng hàm này để đọc cấu hình. */
  async getSettings(): Promise<SystemSettings> {
    const rows = await this.settingsRepository.findBy({ key: In(SETTING_KEYS) });
    const settings = { ...SYSTEM_SETTING_DEFAULTS };
    for (const row of rows) {
      (settings as Record<string, unknown>)[row.key] = row.value;
    }
    return settings;
  }

  /** GET /settings */
  async getView(): Promise<SettingsView> {
    try {
      return await this.buildView();
    } catch (error) {
      handleServiceError(error, this.logger, 'getView');
    }
  }

  /** PUT /settings: chỉ lưu key được gửi lên */
  async update(patch: Partial<SystemSettings>, actorId: string): Promise<SettingsView> {
    try {
      const rows = SETTING_KEYS.filter((key) => patch[key] !== undefined).map((key) =>
        this.settingsRepository.create({ key, value: patch[key], updatedBy: actorId }),
      );
      if (rows.length > 0) await this.settingsRepository.save(rows);
      return await this.buildView();
    } catch (error) {
      handleServiceError(error, this.logger, 'update');
    }
  }

  private async buildView(): Promise<SettingsView> {
    const [settings, latest] = await Promise.all([
      this.getSettings(),
      this.settingsRepository.findOne({ where: {}, order: { updatedAt: 'DESC' } }),
    ]);
    let updatedByName: string | null = null;
    if (latest?.updatedBy) {
      const user = await this.settingsRepository.manager
        .getRepository(Users)
        .findOne({ where: { id: latest.updatedBy }, select: { id: true, username: true } });
      updatedByName = user?.username ?? null;
    }
    return {
      ...settings,
      documentCodePatterns: DOCUMENT_CODE_PATTERNS,
      notificationChannels: Object.values(NotificationChannel).map((value) => ({
        value,
        label: NOTIFICATION_CHANNEL_LABEL[value],
      })),
      updatedAt: latest?.updatedAt ?? null,
      updatedByName,
    };
  }
}
