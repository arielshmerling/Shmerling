const Joi = require("joi");
const ExpressError = require("../src/utils/ExpressError");
const gameTypeSchema = Joi.object({ gameType: Joi.number().min(1).max(3).required() });
const gameIdSchema = Joi.alternatives().try(
    Joi.object({ id: Joi.string().hex().length(24).required() }),
    Joi.object({ id: Joi.string().uuid({ version: ["uuidv4"] }).required() }),
);
const reviewSchema = Joi.object({
    id: Joi.alternatives().try(
        Joi.string().hex().length(24).required(),
        Joi.string().uuid({ version: ["uuidv4"] }).required()),
    type: Joi.string().valid("pgn", "history")
});

const credentialsSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string()
        .pattern(new RegExp("^[a-zA-Z0-9!@#$%&*]{1,30}$"))
        .required(),

});

const webSocketMessageSchema =
    Joi.alternatives().try(
        Joi.object({
            username: Joi.string().required(),
            gameId: Joi.string().hex().length(24).required(),
            type: Joi.string().valid("move", "info", "command").required(),
            isWhite: Joi.bool().required(),
            data: Joi.object({
                capturedPiece : Joi.required(),
                castling : Joi.bool().required(),
                ennPassant : Joi.bool().required(),
                hitSquare : Joi.object({
                    row: Joi.number().min(0).max(7).optional(),
                    col: Joi.number().min(0).max(7).optional(),
                }).allow(null),
                moveStr : Joi.string().min(2).max(10).required(),
                moveTime : Joi.number().required(),
                piece: Joi.object({
                    color : Joi.string().valid("white","black").required(),
                    pieceType : Joi.number().min(0).max(5).required(),
                }).required(),
                promotion : Joi.bool().required(),
                source: Joi.object({
                    row: Joi.number().min(0).max(7).optional(),
                    col: Joi.number().min(0).max(7).optional(),
                }).required(),
                target: Joi.object({
                    row: Joi.number().min(0).max(7).optional(),
                    col: Joi.number().min(0).max(7).optional(),
                }).required(),
                turn : Joi.string().required(),
                valid : Joi.bool().required(),
                whitePlayerView : Joi.bool().required(),                
            }).optional(),
        }),
        Joi.object({
            gameId: Joi.string().hex().length(24).required(),
            info: Joi.string().valid("offer rematch","rematch","resign","offer draw","move accepted","draw accepted","draw declined","draw declined","rematch declined","rematch accepted","outOfTime","Opponent resigned").required(),
            isWhite: Joi.bool().required(),
            moveTime: Joi.number().optional(),
            moveStr: Joi.string().optional(),
            type: Joi.string().valid("info", "command").required(),
            userId: Joi.string().hex().length(24).required(),
            username: Joi.string().required(),
        })
    );

const schemas = {
    "id": gameIdSchema,
    "gameType": gameTypeSchema,
    "review": reviewSchema,
    "credentials": credentialsSchema,
    "webSocketsMessage": webSocketMessageSchema,
};

exports.validate = (obj, validator) => {

    const schema = schemas[validator];
    const { error } = schema.validate(obj);
    if (error) {
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(msg, 400);
    }
};

