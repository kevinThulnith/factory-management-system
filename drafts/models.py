from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator
from django.db import models

# TODO: Add validators to the fields
phone_validator = RegexValidator(
    regex=r'^\d{10}$',
    message=_('Mobile number must be 11 digits')
)

nic_validator = RegexValidator(
    regex=r'^[0-9]{10}$',
    message=_('NIC must be in valid format')
)

# Create your models here.

# !Auth side

class UserManager(BaseUserManager):
  "Custom user manager"
  
  def create_user(self, email, username, password=None, **args):
    "Create and return a user"
    if not email: raise ValueError(_('The email must be set'))
    if not username: raise ValueError(_('The username must be set'))
    
    email = self.normalize_email(email)
    user = self.model(email=email, username=username, **args)
    user.is_active = True 
    user.set_password(password)
    user.save(using=self._db)
    return user

  def create_superuser(self, email, username, password, **args):
    "Create and return a superuser"
    args.setdefault('is_staff', True)
    args.setdefault('is_active', True)
    args.setdefault('is_superuser', True)
    args.setdefault('role', User.Role.ADMIN)
    
    if args.get('is_staff') is not True: raise ValueError(_('Superuser must have is_staff=True.'))
    if args.get('is_superuser') is not True: raise ValueError(_('Superuser must have is_superuser=True.'))
    if args.get('role') != User.Role.ADMIN: raise ValueError(_('Superuser must have role of Admin.'))
    
    return self.create_user(email, username, password, **args)

class User(AbstractUser):
  "Custom user model"
  class Role(models.TextChoices):
    ADMIN = 'ADMIN', _('Admin')
    MANAGER = 'MANAGER', _('Manager')
    SUPERVISOR = 'SUPERVISOR', _('Supervisor')
    OPERATOR = 'OPERATOR', _('Operator')
    TECHNICIAN = 'TECHNICIAN', _('Technician')
    PURCHASING = 'PURCHASING', _('Purchasing Staff')
    
  name = models.CharField(_('name'), max_length=255)
  email = models.EmailField(_('email'), unique=True)
  username = models.CharField(max_length=150, unique=True)
  dob = models.DateField(_('birthday'), null=True, blank=True)
  created_at = models.DateTimeField(_('created at'), auto_now_add=True)
  nic = models.CharField(_('NIC'), max_length=10, unique=True, validators=[nic_validator])
  mobile_no = models.CharField(_('mobile'), max_length=10, unique=True, validators=[phone_validator])
  role = models.CharField(max_length=20, choices=Role.choices, default=Role.OPERATOR)
  
  workshop = models.ForeignKey(
    'Workshop',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='employees' # Allows Workshop.employees.all()
  )
    
  objects = UserManager()
  USERNAME_FIELD = 'username'
  REQUIRED_FIELDS = ['name', 'nic', 'mobile_no', 'email']
  
  class Meta:
    verbose_name = _('User')
    verbose_name_plural = _('Users')
    ordering = ['username']
  
  def __str__(self):
    return self.username

# !Machine side

class Workshop(models.Model):
  "Workshop model"
  name = models.CharField(max_length=100, unique=True)
  location = models.CharField(max_length=150, blank=True)
  supervisor = models.ForeignKey(
    User,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='supervisor',
    limit_choices_to={'role__in': [User.Role.SUPERVISOR, User.Role.MANAGER, User.Role.ADMIN]} # Optional: Limit choices
  )

  class Meta:
    ordering = ['name']
    verbose_name = "Workshop"
    verbose_name_plural = "Workshops"

  def __str__(self):
    return self.name
  
class Machine(models.Model):
  "Machine model"
  class Status(models.TextChoices):
    OPERATIONAL = 'OPERATIONAL', _('Operational')
    IDLE = 'IDLE', _('Idle')
    MAINTENANCE = 'MAINTENANCE', _('Under Maintenance')
    BROKEN = 'BROKEN', _('Broken Down')

  name = models.CharField(max_length=100)
  model_number = models.CharField(max_length=100, blank=True)
  workshop = models.ForeignKey(Workshop, on_delete=models.PROTECT, related_name='machines')
  status = models.CharField(max_length=20, choices=Status.choices, default=Status.IDLE)
  last_maintenance_date = models.DateField(null=True, blank=True)
  next_maintenance_date = models.DateField(null=True, blank=True)
  purchase_date = models.DateField(null=True, blank=True)

  class Meta:
    ordering = ['workshop', 'name']

  def __str__(self):
    return f"{self.name} ({self.workshop.name})"

# !Employee skills

class Skill(models.Model):
  "Skills model"
  name = models.CharField(max_length=100, unique=True)
  description = models.TextField(blank=True)

  class Meta:
    ordering = ['name']

  def __str__(self):
    return self.name
  
class EmployeeSkill(models.Model):
  "Employee skill model"
  class Proficiency(models.TextChoices):
    BEGINNER = 'BEGINNER', _('Beginner')
    INTERMEDIATE = 'INTERMEDIATE', _('Intermediate')
    ADVANCED = 'ADVANCED', _('Advanced')
    EXPERT = 'EXPERT', _('Expert')

  employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='skill_levels')
  skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='employee_levels')
  proficiency_level = models.CharField(max_length=20, choices=Proficiency.choices, default=Proficiency.BEGINNER)
  certification_date = models.DateField(null=True, blank=True)

  class Meta:
    unique_together = ('employee', 'skill') # Ensure an employee doesn't have the same skill twice
    verbose_name = "Employee Skill"
    verbose_name_plural = "Employee Skills"

  def __str__(self):
    return f"{self.employee.email} - {self.skill.name} ({self.get_proficiency_level_display()})"
  
# !Inventory

class Material(models.Model):
  "Material model"
  name = models.CharField(max_length=150)
  description = models.TextField(blank=True)
  unit_of_measure = models.CharField(max_length=20) # e.g., 'kg', 'm', 'pcs'
  specification = models.TextField(blank=True)
  quantity_on_hand = models.DecimalField(max_digits=12, decimal_places=4, default=0.0) 
  reorder_level = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)

  class Meta:
    ordering = ['name']

  def __str__(self):
    return f"{self.name} ({self.unit_of_measure})"

class Supplier(models.Model):
    name = models.CharField(max_length=150, unique=True)
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Draft')
        ORDERED = 'ORDERED', _('Ordered')
        SHIPPED = 'SHIPPED', _('Shipped')
        PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED', _('Partially Received')
        RECEIVED = 'RECEIVED', _('Received Complete')
        CANCELLED = 'CANCELLED', _('Cancelled')

    po_number = models.CharField(max_length=50, unique=True, help_text="Unique Purchase Order Number")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='purchase_orders')
    order_date = models.DateField(auto_now_add=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    actual_delivery_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.DRAFT)
    # total_amount can be calculated or stored
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_pos')

    class Meta:
        ordering = ['-order_date']

    def __str__(self):
        return self.po_number

class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='po_items') # Protect material if used in POs
    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=4)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=4, default=0.0)

    class Meta:
        ordering = ['purchase_order', 'material']
        unique_together = ('purchase_order', 'material') # Can't have same material twice on one PO

    def __str__(self):
        return f"{self.material.name} ({self.quantity_ordered}) for PO {self.purchase_order.po_number}"

    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_price