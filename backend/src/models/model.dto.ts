import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveModelDto {
  @ApiPropertyOptional({ example: 'Parametric bracket' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'JSCAD source code' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: 'mechanical' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: [String], example: ['bracket', 'parametric'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ example: 'aluminum' })
  @IsOptional()
  @IsString()
  material?: string;
}

export class PublishDto {
  @ApiPropertyOptional({ enum: ['private', 'public', 'shared'] })
  @IsOptional()
  @IsIn(['private', 'public', 'shared'])
  visibility?: 'private' | 'public' | 'shared';
}

export class ImportStlDto {
  @ApiProperty({ example: 'Imported part' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'part.stl' })
  @IsString()
  filename!: string;

  @ApiProperty({ description: 'Base64 encoded STL bytes' })
  @IsString()
  dataBase64!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}
