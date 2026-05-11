import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class SaveModelDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  material?: string;
}

export class PublishDto {
  @IsOptional()
  @IsIn(['private', 'public', 'shared'])
  visibility?: 'private' | 'public' | 'shared';
}

export class ImportStlDto {
  @IsString()
  title!: string;

  @IsString()
  filename!: string;

  @IsString()
  dataBase64!: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
