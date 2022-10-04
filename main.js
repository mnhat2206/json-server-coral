const jsonServer = require('json-server');
const queryString = require('query-string');
const { v4 } = require('uuid');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

const db = router.db;

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares);
server.use(jsonServer.bodyParser);

// example get db
// server.get('/sentinel/sensors', (req, res) => {
//     const sentinel = db.get('sentinel').value();
//     const sensors = db.get('sensors').filter({ sentinelId: sentinel.id }).value();
//     res.send({ ...sentinel, sensors: sensors });
// });

// Add custom routes before JSON Server router
server.get('/echo', (req, res) => {
    console.log('echo');
    res.jsonp(req.query);
});

server.get('/api/categoriesChild/:categoryParentId', (req, res) => {
    const { categoryParentId } = req.params;
    const categoriesChild = db
        .get('categories')
        .filter((item) => item.categoryParentId === categoryParentId)
        .value();
    const products = db
        .get('products')
        .filter((product) => categoriesChild.find((item) => item.id === product.categoryId))
        .value();

    res.send({
        categoriesChild: categoriesChild,
        productsTotal: products.length,
        allProducts: products,
    });
});

server.get('/api/category/categoryParent', (req, res) => {
    const { id } = req.query;
    const categoriesDb = [...db.get('categories').value()];
    const categoryParentOptions = [];
    categoriesDb.forEach((item) => {
        if (item.isParent === true) {
            categoryParentOptions.push({
                id: item.id,
                name: item.name,
            });
        }
    });

    if (id) {
        const result = categoriesDb.find((item) => item.id === id);
        if (!result) {
            return res.send({
                errorMessage: 'Invalid category',
            });
        }
        result.categoryParentName = categoryParentOptions.find((item) => item.id === result.categoryParentId) || {};

        res.send({
            data: result,
            categoryParentOptions,
        });
    } else {
        res.send({
            data: [],
            categoryParentOptions,
        });
    }
});

server.get('/api/categories/main', (req, res) => {
    const result = [];
    const categoriesDb = [...db.get('categories').value()];
    categoriesDb.forEach((category) => {
        if (category.isActive && category.isMain) {
            category.categoryParentName = {
                id: category.categoryParentId,
                name: categoriesDb.find((item) => item.id === category.categoryParentId).name,
            };
            result.push(category);
        }
    });

    res.send(result);
});

// Custom API Product
server.get('/api/products/navbar', (req, res) => {
    const queryParams = req.query;
    const { categoryId, isNew, isBestSeller } = queryParams;
    const categories = db.get('categories').value();
    const productsDb = [...db.get('products').value()];

    if (categoryId) {
        const categoryByProduct = categories.find((item) => item.id === categoryId);

        const resProducts = productsDb.filter((product) => {
            product.categoryOption = { id: categoryByProduct.id, name: categoryByProduct.name };
            return product.categoryId === categoryId;
        });

        res.send({
            data: resProducts,
            totalProduct: resProducts.length,
        });
    } else {
        const isNewSet = isNew === 'true';
        const isBestSellerSet = isBestSeller === 'true';
        const resProducts = productsDb.filter((product, index) => {
            const productByCategory = categories.find((category) => category.id === product.categoryId);
            product.categoryOption = { id: productByCategory.id, name: productByCategory.name };

            return product.isNew === isNewSet && product.isBestSeller === isBestSellerSet;
        });

        res.send({
            data: resProducts,
            totalProduct: resProducts.length,
        });
    }
});

server.get('/api/product/categories', (req, res) => {
    const { productId } = req.query;
    const getCategories = [];

    const categories = db
        .get('categories')
        .filter((category) => category.isParent === false)
        .value();
    categories.forEach((category) => {
        const { id, name } = category;
        getCategories.push({ id, name });
    });

    if (!productId) {
        return res.send({
            categories: getCategories,
            product: [],
        });
    }

    const product = db
        .get('products')
        .filter((item) => item.id === productId)
        .value()[0];

    if (!product) {
        return res.send({
            errorMessage: 'Invalid product',
        });
    }

    // custom add categoryOption to product
    product.isFakerData = product.srcImage.substring(0, 23) === 'https://loremflickr.com';

    product.categoryOption = getCategories.find((category) => category.id === product.categoryId);

    res.send({
        product,
        categories: getCategories,
    });
});

// Custom API Authenticated
server.post('/api/login', (req, res) => {
    const userData = req.body;
    const usersDb = db.get('users').value();
    const userLoginSuccess = usersDb.find((user) => {
        return String(user.userName) === userData.userName && String(user.password) === userData.password;
    });
    if (userLoginSuccess) {
        res.send(userLoginSuccess);
    } else {
        res.send({
            errorMessage: 'Incorrect account or password',
        });
    }
});
server.post('/api/register', (req, res, next) => {
    const userRegister = req.body;
    const usersDb = db.get('users').value();
    const errorRegister = [];

    // function getKeyByValue(value) {
    //     console.log(value);
    //     return Object.keys(userRegister).find((key) => userRegister[key] === value);
    // }

    // check error userName
    if (userRegister.userName.length === 0) {
        errorRegister.push({
            fieldName: 'userName',
            errorMessage: 'You have not entered this field',
        });
    }

    // check error password
    if (userRegister.password.length === 0) {
        errorRegister.push({
            fieldName: 'password',
            errorMessage: 'You have not entered this field',
        });
    } else if (userRegister.password.length < 6) {
        errorRegister.push({
            fieldName: 'password',
            errorMessage: 'Password must be at least 6 characters',
        });
    }

    // check error phoneNumber
    if (userRegister.phoneNumber.length === 0) {
        errorRegister.push({
            fieldName: 'phoneNumber',
            errorMessage: 'You have not entered this field',
        });
    }

    // check error fullName
    if (userRegister.fullName.length === 0) {
        errorRegister.push({
            fieldName: 'fullName',
            errorMessage: 'You have not entered this field',
        });
    }

    // if error return
    if (errorRegister.length > 0) {
        return res.send({
            title: 'Input Error',
            errorRegister,
        });
    }

    usersDb.forEach((user) => {
        if (user.userName === userRegister.userName) {
            errorRegister.push({
                fieldName: 'userName',
                errorMessage: `${userRegister.userName} already exists`,
            });
        }

        if (user.phoneNumber === userRegister.phoneNumber) {
            errorRegister.push({
                fieldName: 'phoneNumber',
                errorMessage: `${userRegister.phoneNumber} already exists`,
            });
        }
    });

    if (errorRegister.length > 0) {
        res.send({
            title: 'Input Error',
            errorRegister,
        });
    } else {
        userRegister.address = '';
        userRegister.birthDay = null;
        userRegister.isCustomer = true;
        userRegister.isActive = true;
        userRegister.avatar = '';
        userRegister.id = v4();
        next();
    }
});

// Add this before server.use(router)
server.use(
    jsonServer.rewriter({
        '/api/register': '/api/users',
    }),
);

// To handle POST, PUT and PATCH you need to use a body-parser
// You can use the one used by JSON Server

server.use((req, res, next) => {
    if (req.method === 'POST') {
        req.body.createdAt = Date.now();
        req.body.updateAt = Date.now();
    }
    // Continue to JSON Server router
    next();
});
// In this example, returned resources will be wrapped in a body property
router.render = (req, res) => {
    // Check GET with pagination
    // If yes, custom output
    const headers = res.getHeaders();

    const totalCountHeaders = headers['x-total-count'];

    if (req.method === 'GET' && totalCountHeaders) {
        const queryParams = queryString.parse(req._parsedUrl.query);

        const result = {
            data: res.locals.data,
            pagination: {
                _page: +queryParams._page || 1,
                _limit: +queryParams._limit || 5,
                _totalRows: +totalCountHeaders,
            },
        };

        return res.jsonp(result);
    }

    // Otherwise, keep default behavior
    return res.jsonp(res.locals.data);

    // res.jsonp(res.locals.data);
};

// Use default router
server.use('/api', router);
server.listen(3002, () => {
    console.log('JSON Server is running');
});
