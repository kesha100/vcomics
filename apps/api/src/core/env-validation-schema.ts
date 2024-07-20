import * as Joi from 'joi';

export interface EnvironmentVariables {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  OPENAI_API_KEY: string;

  PORT: number;
}

export const envValidationSchema = Joi.object<EnvironmentVariables, true>({
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  OPENAI_API_KEY: Joi.string().required(),

  PORT: Joi.number().default(8080),
});
