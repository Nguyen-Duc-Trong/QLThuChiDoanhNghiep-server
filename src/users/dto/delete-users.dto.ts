import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class DeleteUsersDto {
  @IsArray({ message: 'ids phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách ID người dùng không được để trống' })
  @IsUUID('all', { each: true, message: 'ID người dùng không hợp lệ' })
  ids: string[];
}
