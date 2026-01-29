// ============================================================
// middleware/validation.js
// Validation des entrées avec express-validator
// ============================================================

const { body, validationResult } = require('express-validator');

/**
 * Middleware de gestion des erreurs de validation
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

/**
 * Règles de validation pour la connexion
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Format email invalide')
    .isLength({ max: 255 }).withMessage('Email trop long (max 255 caractères)'),
  
  body('password')
    .notEmpty().withMessage('Mot de passe requis')
    .isLength({ min: 1, max: 128 }).withMessage('Mot de passe invalide'),
  
  handleValidationErrors
];

/**
 * Règles de validation pour l'inscription/création d'utilisateur
 */
const registerValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Format email invalide')
    .isLength({ max: 255 }).withMessage('Email trop long (max 255 caractères)'),
  
  body('password')
    .notEmpty().withMessage('Mot de passe requis')
    .isLength({ min: 8, max: 128 }).withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir au moins une minuscule')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Le mot de passe doit contenir au moins un caractère spécial'),
  
  body('nom')
    .trim()
    .notEmpty().withMessage('Nom requis')
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/).withMessage('Le nom contient des caractères invalides'),
  
  body('prenom')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Le prénom ne doit pas dépasser 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']*$/).withMessage('Le prénom contient des caractères invalides'),
  
  body('role')
    .optional()
    .isIn(['admin', 'user', 'readonly']).withMessage('Rôle invalide (admin, user, readonly)'),
  
  handleValidationErrors
];

/**
 * Règles de validation pour la mise à jour d'utilisateur
 */
const updateUserValidation = [
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Format email invalide')
    .isLength({ max: 255 }).withMessage('Email trop long'),
  
  body('nom')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/).withMessage('Le nom contient des caractères invalides'),
  
  body('prenom')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Le prénom ne doit pas dépasser 100 caractères'),
  
  body('role')
    .optional()
    .isIn(['admin', 'user', 'readonly']).withMessage('Rôle invalide'),
  
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active doit être un booléen'),
  
  handleValidationErrors
];

/**
 * Règles de validation pour le changement de mot de passe
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Mot de passe actuel requis'),
  
  body('newPassword')
    .notEmpty().withMessage('Nouveau mot de passe requis')
    .isLength({ min: 8, max: 128 }).withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir au moins une minuscule')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Le mot de passe doit contenir au moins un caractère spécial')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('Le nouveau mot de passe doit être différent de l\'ancien');
      }
      return true;
    }),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirmation du mot de passe requise')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Règles de validation pour la réinitialisation de mot de passe
 */
const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Token requis')
    .isLength({ min: 64, max: 64 }).withMessage('Token invalide'),
  
  body('newPassword')
    .notEmpty().withMessage('Nouveau mot de passe requis')
    .isLength({ min: 8, max: 128 }).withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir au moins une minuscule')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Le mot de passe doit contenir au moins un caractère spécial'),
  
  handleValidationErrors
];

/**
 * Règles de validation pour la demande de réinitialisation
 */
const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Format email invalide'),
  
  handleValidationErrors
];

/**
 * Règles de validation pour le refresh token
 */
const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token requis')
    .isLength({ min: 128, max: 128 }).withMessage('Format de token invalide'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  loginValidation,
  registerValidation,
  updateUserValidation,
  changePasswordValidation,
  resetPasswordValidation,
  forgotPasswordValidation,
  refreshTokenValidation
};
