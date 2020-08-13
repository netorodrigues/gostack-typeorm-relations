import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('customer not found');
    }

    const productEntries = await this.productsRepository.findAllById(products);

    if (!productEntries.length) {
      throw new AppError('products not found');
    }

    const existingProductsIds = productEntries.map(product => product.id);
    const checkInexistentProducts = products.filter(
      product => !existingProductsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError('some products does not exists');
    }

    const findProductsWithNoQuantitiesAvailable = products.filter(
      product =>
        productEntries.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantitiesAvailable.length) {
      throw new AppError('Some products have no quantities available');
    }

    const serializedProduct = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productEntries.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProduct,
    });

    const orderProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productEntries.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
