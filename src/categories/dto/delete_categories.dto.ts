import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class DeleteCategoriesDto {
  @IsArray({ message: 'ids phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách ID danh mục không được để trống' })
  @IsUUID('all', { each: true, message: 'ID danh mục không hợp lệ' })
  ids: string[];
}