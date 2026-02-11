const selectors = {
  customerAddresses: '[data-customer-addresses]',
  addressCountrySelect: '[data-address-country-select]',
  addressContainer: '[data-address]',
  toggleAddressButton: 'button[aria-expanded]',
  cancelAddressButton: 'button[type="reset"]',
  deleteAddressButton: 'button[data-confirm-message]',
};

const attributes = {
  expanded: 'aria-expanded',
  confirmMessage: 'data-confirm-message',
};

class CustomerAddresses {
  constructor() {
    this.elements = this._getElements();
    if (Object.keys(this.elements).length === 0) return;
    this._setupCountries();
    this._setupEventListeners();
  }

  _getElements() {
    const container = document.querySelector(selectors.customerAddresses);
    return container
      ? {
          container,
          addressContainer: container.querySelector(selectors.addressContainer),
          toggleButtons: document.querySelectorAll(selectors.toggleAddressButton),
          cancelButtons: container.querySelectorAll(selectors.cancelAddressButton),
          deleteButtons: container.querySelectorAll(selectors.deleteAddressButton),
          countrySelects: container.querySelectorAll(selectors.addressCountrySelect),
        }
      : {};
  }

  _setupCountries() {
    if (Shopify && Shopify.CountryProvinceSelector) {
      // eslint-disable-next-line no-new
      new Shopify.CountryProvinceSelector('AddressCountryNew', 'AddressProvinceNew', {
        hideElement: 'AddressProvinceContainerNew',
      });
      this.elements.countrySelects.forEach((select) => {
        const formId = select.dataset.formId;
        // eslint-disable-next-line no-new
        new Shopify.CountryProvinceSelector(`AddressCountry_${formId}`, `AddressProvince_${formId}`, {
          hideElement: `AddressProvinceContainer_${formId}`,
        });
      });
    }
  }

  _setupEventListeners() {
    this.elements.toggleButtons.forEach((element) => {
      element.addEventListener('click', this._handleAddEditButtonClick);
    });
    this.elements.cancelButtons.forEach((element) => {
      element.addEventListener('click', this._handleCancelButtonClick);
    });
    this.elements.deleteButtons.forEach((element) => {
      element.addEventListener('click', this._handleDeleteButtonClick);
    });
  }

  _toggleExpanded(target) {
    target.setAttribute(attributes.expanded, (target.getAttribute(attributes.expanded) === 'false').toString());
  }

  _handleAddEditButtonClick = ({ currentTarget }) => {
    const isExpanding = currentTarget.getAttribute(attributes.expanded) === 'false';
    const controlsId = currentTarget.getAttribute('aria-controls');
    
    // If opening a form, close all other forms
    if (isExpanding) {
      // If this is the "Add Address" button, close all edit forms
      if (controlsId === 'AddAddress') {
        this._closeAllEditForms();
        // Show the Add Address form
        const addAddressForm = document.getElementById('AddAddress');
        if (addAddressForm) {
          addAddressForm.style.display = '';
        }
      } else {
        // If this is an edit button, close the Add Address form and all other edit forms
        this._closeAddAddressForm();
        this._closeAllEditForms();
      }
    } else {
      // If closing a form
      if (controlsId === 'AddAddress') {
        const addAddressForm = document.getElementById('AddAddress');
        if (addAddressForm) {
          addAddressForm.style.display = 'none';
        }
      }
    }
    
    this._toggleExpanded(currentTarget);
  };

  _closeAllEditForms() {
    const allEditForms = document.querySelectorAll('[id^="EditAddress_"]');
    allEditForms.forEach((form) => {
      form.style.display = 'none';
      const buttonId = form.id.replace('EditAddress_', 'EditFormButton_');
      const button = document.getElementById(buttonId);
      if (button) {
        button.setAttribute(attributes.expanded, 'false');
      }
    });
  }

  _closeAddAddressForm() {
    const addAddressForm = document.getElementById('AddAddress');
    if (addAddressForm) {
      addAddressForm.style.display = 'none';
      const addAddressButton = addAddressForm.previousElementSibling;
      if (addAddressButton && addAddressButton.getAttribute('aria-controls') === 'AddAddress') {
        addAddressButton.setAttribute(attributes.expanded, 'false');
      }
    }
  }

  _handleCancelButtonClick = ({ currentTarget }) => {
    // Find the form that contains this cancel button
    const form = currentTarget.closest('form');
    if (form) {
      const formContainer = form.closest('[id^="EditAddress_"], #AddAddress');
      if (formContainer) {
        formContainer.style.display = 'none';
      }
    }
    
    // Find and update the toggle button
    const addressContainer = currentTarget.closest(selectors.addressContainer);
    if (addressContainer) {
      const toggleButton = addressContainer.querySelector(`[${attributes.expanded}]`);
      if (toggleButton) {
        toggleButton.setAttribute(attributes.expanded, 'false');
      }
    } else {
      // For Add Address form, find the button that controls it
      const addAddressButton = document.querySelector('button[aria-controls="AddAddress"]');
      if (addAddressButton) {
        addAddressButton.setAttribute(attributes.expanded, 'false');
      }
    }
  };

  _handleDeleteButtonClick = ({ currentTarget }) => {
    // eslint-disable-next-line no-alert
    if (confirm(currentTarget.getAttribute(attributes.confirmMessage))) {
      Shopify.postLink(currentTarget.dataset.target, {
        parameters: { _method: 'delete' },
      });
    }
  };
}
