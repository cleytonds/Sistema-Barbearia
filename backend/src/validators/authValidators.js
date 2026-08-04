import { body } from 'express-validator';

const passwordRules = (field) => body(field)
  .isString().withMessage('deve ser uma string')
  .isLength({ min: 8, max: 72 }).withMessage('deve ter entre 8 e 72 caracteres')
  .matches(/[A-Za-zÀ-ÿ]/).withMessage('deve conter uma letra')
  .matches(/\d/).withMessage('deve conter um número');

export const registerValidator = [
  body().custom((value) => {
    const allowed = ['nome', 'email', 'telefone', 'senha', 'confirmacaoSenha'];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error('contém campos não permitidos');
    return true;
  }),
  body('nome').isString().trim().isLength({ min: 3, max: 150 }).withMessage('deve ter entre 3 e 150 caracteres').matches(/^[\p{L}\p{M}' -]+$/u).withMessage('contém caracteres inválidos'),
  body('email').isString().trim().isLength({ max: 254 }).isEmail().withMessage('inválido'),
  body('telefone').isString().customSanitizer((value) => value.replace(/\D/g, '')).isLength({ min: 10, max: 11 }).withMessage('deve conter DDD e 10 ou 11 dígitos'),
  passwordRules('senha'),
  body('confirmacaoSenha').custom((value, { req }) => value === req.body.senha).withMessage('não confere com a senha')
];

export const loginValidator = [
  body('email').isString().trim().isLength({ max: 254 }).isEmail().withMessage('inválido'),
  body('senha').isString().isLength({ min: 1, max: 72 }).withMessage('inválida')
];

export const forgotPasswordValidator = [body('email').isString().trim().isLength({ max: 254 }).isEmail().withMessage('inválido')];

export const resetPasswordValidator = [
  body('token').isString().matches(/^[a-f0-9]{64}$/).withMessage('inválido'),
  passwordRules('novaSenha'),
  body('confirmacaoNovaSenha').custom((value, { req }) => value === req.body.novaSenha).withMessage('não confere com a nova senha')
];

export const changePasswordValidator = [
  body('senhaAtual').isString().isLength({ min: 1, max: 72 }).withMessage('inválida'),
  passwordRules('novaSenha'),
  body('confirmacaoNovaSenha').custom((value, { req }) => value === req.body.novaSenha).withMessage('não confere com a nova senha')
];

